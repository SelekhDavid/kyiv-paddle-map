import { useEffect, useState } from 'react'
import type {
  ClassificationDoc,
  HydroPostMarker,
  HydroPostsDoc,
  PaddleVerdict,
  RestrictionLevel,
  RiverHazard,
  RiverHazardsDoc,
  RiverWidthOsmEntry,
  RiverWidthsDoc,
  RulesDoc,
  Spot,
  WaterIncidentsDoc,
  WaterIncident,
  WaterQualityDoc,
  WaterQualitySiteMarker,
  WaterShapeCollection,
} from '../types'
import {
  haversineKm,
  interiorPointForShape,
  isStandingWaterKind,
  matchSpotToShape,
  riverNameToken,
  spotMatchedOsmIds,
  standingAnchorOnShapes,
} from '../lib/geo'
import { filterFeaturesToMapExtent, inMapExtent } from '../lib/mapExtent'
import {
  isPaddleMapRestriction,
  paddleVerdictFromEntry,
  recentReports,
  type ClubTripReportsDoc,
} from '../lib/paddleReports'

const DEFAULT_QUARRY_RESTRICTION = {
  level: 'check_local' as const,
  labelUk: 'Карʼєр — перевірте доступ і правила',
  labelEn: 'Quarry — check access and community rules',
  notesUk:
    'Карʼєрні водойми часто приватні або небезпечні (обриви, техніка). Окремої заборони громади може не бути — уточніть доступ, власника і місцеві правила безпеки.',
  sources: [],
}

const LEVEL_LABEL: Record<RestrictionLevel, { uk: string; en: string }> = {
  banned_navigation: {
    uk: 'Виходити на воду заборонено (Дніпро / каскад)',
    en: 'Navigation ban (Dnipro / cascade)',
  },
  oblast_ban: {
    uk: 'Обласна заборона',
    en: 'Oblast navigation ban',
  },
  restricted: {
    uk: 'Є заборона від громади',
    en: 'Restricted (local communities)',
  },
  check_local: {
    uk: 'Перевірте правила на місці',
    en: 'Check locally',
  },
  likely_ok: {
    uk: 'Немає відомої заборони громади',
    en: 'Likely ok',
  },
}

function deriveSpotsFromShapes(shapes: WaterShapeCollection['features'], curated: Spot[]): Spot[] {
  const taken = new Set<string>()
  for (const s of curated) {
    for (const id of spotMatchedOsmIds(s)) taken.add(id)
  }
  const curatedStanding = curated.filter((s) => isStandingWaterKind(s.kind))
  /** Prefix stems (≥6) so «Блакитні» ↔ «Блакитне» collide. */
  const curatedStems = new Set<string>()
  for (const s of curatedStanding) {
    for (const raw of [s.osmHint, s.nameUk, s.matchedOsmNameUk]) {
      if (!raw) continue
      for (const part of String(raw)
        .toLowerCase()
        .split(/[^a-zа-яёіїєґ0-9]+/i)) {
        if (part.length >= 5) curatedStems.add(part.slice(0, 6))
      }
    }
  }
  const derived: Spot[] = []

  for (const f of shapes) {
    const p = f.properties
    if (taken.has(p.osmId)) continue
    const name = p.nameUk || p.name
    if (!name) continue
    const nameTrim = name.trim()
    // Skip generic / low-value OSM labels (runtime: «Карʼєр», «Глина», «1», «2»…)
    if (
      nameTrim === 'Водойма' ||
      nameTrim === 'Карʼєр (без назви)' ||
      nameTrim === 'Річка' ||
      /^(кар[ʼ'′]?єр|глина|відвал(\s+піску)?|ставок|озеро)$/i.test(nameTrim) ||
      /^\d+$/.test(nameTrim) ||
      nameTrim.length < 3
    ) {
      continue
    }
    if (p.kind === 'river') continue
    if (f.geometry.type === 'LineString') continue

    const nameParts = nameTrim
      .toLowerCase()
      .split(/[^a-zа-яёіїєґ0-9]+/i)
      .filter((t) => t.length >= 5)
      .map((t) => t.slice(0, 6))
    if (nameParts.some((t) => curatedStems.has(t))) continue

    const token = riverNameToken(name)
    if (token.length >= 5 && curatedStems.has(token.slice(0, 6))) continue

    const anchor = interiorPointForShape(f) ?? { lat: p.lat, lng: p.lng }
    // Drop OSM twins near an already-curated standing spot
    if (curatedStanding.some((s) => haversineKm(s, { lat: anchor.lat, lng: anchor.lng }) < 2.5)) {
      continue
    }

    const id = `osm-${p.osmId.replace('/', '-')}`
    const isQuarry = p.kind === 'quarry' || /кар/i.test(name)
    derived.push({
      id,
      nameUk: name,
      nameEn: p.nameEn || name,
      lat: anchor.lat,
      lng: anchor.lng,
      kind: p.kind,
      region: 'Kyiv oblast / OSM',
      osmHint: name,
      paddleSuitability: isQuarry ? 'moderate_when_allowed' : 'good_when_allowed',
      swimSuitability: isQuarry ? 'variable' : 'moderate',
      restriction: isQuarry
        ? DEFAULT_QUARRY_RESTRICTION
        : {
            level: 'likely_ok',
            labelUk: 'Немає відомої заборони громади',
            labelEn: 'No confirmed local ban (OSM)',
            notesUk:
              'Додано з відкритої мапи. Окремої заборони громади для цієї водойми не знайдено. Загальна заборона області на навігацію під час воєнного стану може все одно діяти — це не дозвіл.',
            sources: [],
          },
      touristLoad: {
        grade: 2,
        labelUk: 'зазвичай тихше',
        basis: 'OSM named feature; low national tourism footprint',
        peakHintUk: 'більше місцевих відвідувачів',
        sources: ['OpenStreetMap'],
        updated: '2026-08',
      },
      amenities: isQuarry ? ['quarry'] : ['shore'],
      accessUk: 'Уточніть під’їзд на місці',
      tipsUk: 'Перевірте, чи можна підійти до берега і чи безпечна місцевість.',
      derived: true,
      matchedOsmId: p.osmId,
      matchedOsmIds: [p.osmId],
      matchedOsmNameUk: name,
    })
  }

  return derived
    .sort((a, b) => {
      const rank = (k: string) =>
        k === 'lake' ? 0 : k === 'reservoir' ? 1 : k === 'pond' ? 2 : k === 'quarry' ? 3 : 4
      return rank(a.kind) - rank(b.kind) || a.nameUk.localeCompare(b.nameUk, 'uk')
    })
    .slice(0, 120)
}

/** Add list entries for major classified rivers not already covered */
function deriveRiverSpotsFromClassification(
  classification: ClassificationDoc,
  shapes: WaterShapeCollection['features'],
  curated: Spot[],
): Spot[] {
  const takenTokens = new Set(
    curated
      .filter((s) => /river|bay|channel/i.test(s.kind))
      .map((s) => riverNameToken(s.osmHint || s.nameUk))
      .filter(Boolean),
  )
  const byToken = new Map<string, { osmId: string; lat: number; lng: number; name: string; level: RestrictionLevel; reasonUk: string }>()

  for (const f of shapes) {
    if (f.geometry.type !== 'LineString' || f.properties.kind !== 'river') continue
    const entry = classification.features[f.properties.osmId]
    if (!entry) continue
    const name = entry.name || f.properties.nameUk || f.properties.name
    if (!name || name === 'Річка') continue
    const token = riverNameToken(name)
    if (!token || takenTokens.has(token)) continue
    if (!byToken.has(token)) {
      byToken.set(token, {
        osmId: f.properties.osmId,
        lat: f.properties.lat,
        lng: f.properties.lng,
        name,
        level: entry.level,
        reasonUk: entry.reasonUk,
      })
    }
  }

  const checked = classification.checkedAt
  return [...byToken.entries()].slice(0, 40).map(([token, v]) => {
    const labels = LEVEL_LABEL[v.level]
    return {
      id: `river-class-${token}`,
      nameUk: v.name,
      nameEn: v.name,
      lat: v.lat,
      lng: v.lng,
      kind: 'river',
      region: 'Kyiv oblast / classified',
      osmHint: v.name,
      paddleSuitability: 'good_when_allowed' as const,
      swimSuitability: 'moderate',
      restriction: {
        level: v.level,
        labelUk: labels.uk,
        labelEn: labels.en,
        notesUk: `${v.reasonUk} Перевірено станом на ${checked}.`,
        sources: [],
      },
      touristLoad: {
        grade: 2 as const,
        labelUk: 'за даними мапи',
        basis: 'auto-classified OSM river',
        peakHintUk: 'див. статус вище',
        sources: ['classification.json'],
        updated: checked.slice(0, 7),
      },
      amenities: ['nature'],
      accessUk: 'Уточніть під’їзд на місці',
      tipsUk: 'Статус зібрано з відкритих правил. Перед виходом перевірте актуальні місцеві обмеження.',
      derived: true,
      matchedOsmId: v.osmId,
    }
  })
}

function applyClubTripReports(
  spots: Spot[],
  club: ClubTripReportsDoc | null,
  shapes: WaterShapeCollection['features'],
): { spots: Spot[]; paddleByToken: Record<string, PaddleVerdict> } {
  const paddleByToken: Record<string, PaddleVerdict> = {}
  if (!club) return { spots, paddleByToken }

  for (const [token, entry] of Object.entries(club.byRiverNameToken || {})) {
    const v = paddleVerdictFromEntry(entry)
    if (v) paddleByToken[token] = v
  }

  const bySpot = club.bySpotId || {}
  let next = spots.map((s) => {
    // Red cascade / banned waters never appear in paddle mode
    if (!isPaddleMapRestriction(s.restriction.level)) return s

    const fromSpot = bySpot[s.id]
    let verdict = paddleVerdictFromEntry(fromSpot)
    let reports = recentReports(fromSpot?.reports)
    let notes = fromSpot?.notesUk

    if (!verdict) {
      const token = riverNameToken(s.osmHint || s.nameUk)
      if (token && paddleByToken[token]) {
        verdict = paddleByToken[token]
        const tokenEntry = club.byRiverNameToken?.[token]
        const tokenReports = recentReports(tokenEntry?.reports)
        reports = tokenReports.length ? tokenReports : reports
        notes = tokenEntry?.notesUk || notes
      }
    }

    if (!verdict) return s
    return {
      ...s,
      paddleVerdict: verdict,
      paddleReports: reports,
      paddleNotesUk: notes,
    }
  })

  // Synthetic list entries for named rivers with reports from 2023+ but no curated spot
  const haveToken = new Set(
    next.map((s) => riverNameToken(s.osmHint || s.nameUk)).filter(Boolean),
  )
  for (const [token, entry] of Object.entries(club.byRiverNameToken || {})) {
    const verdict = paddleVerdictFromEntry(entry)
    if (!verdict || haveToken.has(token)) continue
    const shape = shapes.find((f) => {
      if (f.geometry.type !== 'LineString' || f.properties.kind !== 'river') return false
      const n = f.properties.nameUk || f.properties.name || ''
      return riverNameToken(n) === token
    })
    if (!shape) continue
    const name = shape.properties.nameUk || shape.properties.name || token
    const recent = recentReports(entry.reports)
    next.push({
      id: `paddle-river-${token}`,
      nameUk: name,
      nameEn: name,
      lat: shape.properties.lat,
      lng: shape.properties.lng,
      kind: 'river',
      region: 'Kyiv oblast / paddle reports ≥2023',
      osmHint: name,
      paddleSuitability: verdict === 'ok' ? 'good_when_allowed' : 'poor',
      swimSuitability: 'moderate',
      restriction: {
        level: 'check_local',
        labelUk: 'За свіжими згадками про сплав',
        labelEn: 'See paddle mode',
        notesUk: entry.notesUk || 'Є актуальні (з 2023) тури, прокат або звіти про сплави.',
        sources: recent.map((r) => r.url).filter(Boolean),
      },
      touristLoad: {
        grade: 2,
        labelUk: 'є згадки про сплав з 2023+',
        basis: 'club-trip-reports',
        peakHintUk: 'див. посилання у звітах',
        sources: ['club-trip-reports.json'],
        updated: club.checkedAt?.slice(0, 7) || '2026-08',
      },
      amenities: ['nature'],
      accessUk: 'Дивіться опис у джерелах нижче',
      tipsUk: entry.notesUk || '',
      derived: true,
      matchedOsmId: shape.properties.osmId,
      paddleVerdict: verdict,
      paddleReports: recent,
      paddleNotesUk: entry.notesUk,
    })
    haveToken.add(token)
  }

  return { spots: next, paddleByToken }
}

export function useMapData() {
  const [spots, setSpots] = useState<Spot[]>([])
  const [rules, setRules] = useState<RulesDoc | null>(null)
  const [shapes, setShapes] = useState<WaterShapeCollection | null>(null)
  const [classification, setClassification] = useState<ClassificationDoc | null>(null)
  const [paddleByToken, setPaddleByToken] = useState<Record<string, PaddleVerdict>>({})
  const [hazards, setHazards] = useState<RiverHazard[]>([])
  const [hydroPosts, setHydroPosts] = useState<HydroPostMarker[]>([])
  const [waterQuality, setWaterQuality] = useState<WaterQualitySiteMarker[]>([])
  const [waterIncidents, setWaterIncidents] = useState<WaterIncident[]>([])
  const [riverWidthsByOsmId, setRiverWidthsByOsmId] = useState<Record<string, RiverWidthOsmEntry>>(
    {},
  )
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const ac = new AbortController()

    async function load() {
      try {
        const settled = await Promise.allSettled([
          fetch('/data/spots.json', { signal: ac.signal }),
          fetch('/data/rules.json', { signal: ac.signal }),
          fetch('/data/water-shapes.geojson', { signal: ac.signal }),
          fetch('/data/classification.json', { signal: ac.signal }),
          fetch('/data/club-trip-reports.json', { signal: ac.signal }),
          fetch('/data/river-hazards.json', { signal: ac.signal }),
          fetch('/data/hydro-posts.json', { signal: ac.signal }),
          fetch('/data/water-quality.json', { signal: ac.signal }),
          fetch('/data/water-incidents.json', { signal: ac.signal }),
          fetch('/data/river-widths.json', { signal: ac.signal }),
        ])

        const res = (i: number): Response | null => {
          const r = settled[i]
          return r.status === 'fulfilled' ? r.value : null
        }

        const spotsRes = res(0)
        const rulesRes = res(1)
        const shapesRes = res(2)
        const classRes = res(3)
        const clubRes = res(4)
        const hazardsRes = res(5)
        const hydroRes = res(6)
        const wqRes = res(7)
        const wiRes = res(8)
        const widthsRes = res(9)

        if (!spotsRes?.ok || !rulesRes?.ok) {
          throw new Error('Не вдалося завантажити дані локацій')
        }
        let curated = (await spotsRes.json()) as Spot[]
        const rulesJson = (await rulesRes.json()) as RulesDoc
        let shapesJson: WaterShapeCollection | null = null
        let classJson: ClassificationDoc | null = null
        let clubJson: ClubTripReportsDoc | null = null
        let hazardsList: RiverHazard[] = []
        let hydroList: HydroPostMarker[] = []
        let wqList: WaterQualitySiteMarker[] = []
        let incidentsList: WaterIncident[] = []
        let widthsByOsm: Record<string, RiverWidthOsmEntry> = {}
        if (classRes?.ok) {
          classJson = (await classRes.json()) as ClassificationDoc
        }
        if (clubRes?.ok) {
          clubJson = (await clubRes.json()) as ClubTripReportsDoc
        }
        if (hazardsRes?.ok) {
          const hz = (await hazardsRes.json()) as RiverHazardsDoc
          hazardsList = hz.features || []
        }
        if (hydroRes?.ok) {
          const hp = (await hydroRes.json()) as HydroPostsDoc
          const obs = hp.observations || {}
          hydroList = (hp.stations || [])
            .filter((s) => inMapExtent(s.lat, s.lng))
            .map((s) => {
              const o = obs[s.id]
              return {
                ...s,
                levelCm: o?.levelCm ?? null,
                observedAt: o?.observedAt ?? null,
                tempC: o?.tempC ?? null,
                changeCm: o?.changeCm ?? null,
              }
            })
        }
        if (wqRes?.ok) {
          const wqDoc = (await wqRes.json()) as WaterQualityDoc
          const obs = wqDoc.observations || {}
          wqList = (wqDoc.sampleSites || []).map((s) => {
            const o = obs[s.id]
            return {
              ...s,
              status: o?.status ?? 'unknown',
              labelUk: o?.labelUk ?? null,
              sampledAt: o?.sampledAt ?? null,
              metricsNoteUk: o?.metricsNoteUk ?? null,
              confidence: o?.confidence ?? null,
              sourceUrls: o?.sourceUrls ?? [],
              authority: o?.authority ?? null,
            }
          })
        }
        if (wiRes?.ok) {
          const wi = (await wiRes.json()) as WaterIncidentsDoc
          incidentsList = wi.incidents || []
        }
        if (widthsRes?.ok) {
          const wd = (await widthsRes.json()) as RiverWidthsDoc
          widthsByOsm = wd.byOsmId || {}
        }
        if (shapesRes?.ok) {
          shapesJson = (await shapesRes.json()) as WaterShapeCollection
          // Cut Belarus border belt / deep Chernihiv spill from loaded geometry
          shapesJson = {
            ...shapesJson,
            features: filterFeaturesToMapExtent(shapesJson.features),
          }
          curated = curated.map((s) => {
            const features = shapesJson!.features
            const byOsm = new Map(features.map((f) => [f.properties.osmId, f]))
            const explicit = spotMatchedOsmIds(s)

            if (isStandingWaterKind(s.kind)) {
              if (explicit.length) {
                const anchor = standingAnchorOnShapes({ ...s, matchedOsmIds: explicit }, byOsm)
                if (anchor) {
                  return {
                    ...s,
                    matchedOsmId: explicit[0],
                    matchedOsmIds: explicit,
                    matchedOsmNameUk:
                      byOsm.get(explicit[0]!)?.properties.nameUk ||
                      byOsm.get(explicit[0]!)?.properties.name ||
                      undefined,
                    lat: anchor.lat,
                    lng: anchor.lng,
                  }
                }
                return { ...s, matchedOsmId: explicit[0], matchedOsmIds: explicit }
              }
              const m = matchSpotToShape(s, features)
              if (!m) return s
              const inside = interiorPointForShape(m) ?? {
                lat: m.properties.lat,
                lng: m.properties.lng,
              }
              if (inside.lat == null || inside.lng == null) return s
              return {
                ...s,
                matchedOsmId: m.properties.osmId,
                matchedOsmIds: [m.properties.osmId],
                matchedOsmNameUk: m.properties.nameUk || m.properties.name || undefined,
                lat: inside.lat,
                lng: inside.lng,
              }
            }

            // Rivers / channels: keep previous segment mid / property lat-lng behaviour
            if (explicit.length) {
              const primary = byOsm.get(explicit[0])?.properties
              if (primary?.lat != null && primary.lng != null) {
                return {
                  ...s,
                  matchedOsmId: explicit[0],
                  matchedOsmIds: explicit,
                  lat: primary.lat,
                  lng: primary.lng,
                }
              }
              return { ...s, matchedOsmId: explicit[0], matchedOsmIds: explicit }
            }
            const m = matchSpotToShape(s, features)
            if (!m || m.properties.lat == null || m.properties.lng == null) return s
            return {
              ...s,
              matchedOsmId: m.properties.osmId,
              matchedOsmIds: [m.properties.osmId],
              lat: m.properties.lat,
              lng: m.properties.lng,
            }
          })
          // H4: standing without OSM bind stay as coarse pins — drop from product list
          curated = curated.filter(
            (s) => !isStandingWaterKind(s.kind) || spotMatchedOsmIds(s).length > 0,
          )
          // stamp checkedAt onto curated tips if classification present
          if (classJson?.checkedAt) {
            curated = curated.map((s) => ({
              ...s,
              restriction: {
                ...s.restriction,
                notesUk: s.restriction.notesUk.includes('станом на')
                  ? s.restriction.notesUk
                  : `${s.restriction.notesUk} Перевірено станом на ${classJson!.checkedAt}.`,
              },
            }))
          }
          const derived = deriveSpotsFromShapes(shapesJson.features, curated)
          const riverDerived = classJson
            ? deriveRiverSpotsFromClassification(classJson, shapesJson.features, curated)
            : []
          const merged = applyClubTripReports(
            [...curated, ...derived, ...riverDerived],
            clubJson,
            shapesJson.features,
          )
          if (!ac.signal.aborted) {
            setShapes(shapesJson)
            setClassification(classJson)
            setSpots(merged.spots)
            setPaddleByToken(merged.paddleByToken)
            setHazards(hazardsList)
            setHydroPosts(hydroList)
            setWaterQuality(wqList)
            setWaterIncidents(incidentsList)
            setRiverWidthsByOsmId(widthsByOsm)
            setRules(rulesJson)
          }
        } else if (!ac.signal.aborted) {
          const merged = applyClubTripReports(curated, clubJson, [])
          setSpots(merged.spots)
          setPaddleByToken(merged.paddleByToken)
          setHazards(hazardsList)
          setHydroPosts(hydroList)
          setWaterQuality(wqList)
          setWaterIncidents(incidentsList)
          setRiverWidthsByOsmId(widthsByOsm)
          setRules(rulesJson)
          setClassification(classJson)
        }
      } catch (e) {
        if (ac.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Помилка завантаження')
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => ac.abort()
  }, [])

  return {
    spots,
    rules,
    shapes,
    classification,
    paddleByToken,
    hazards,
    hydroPosts,
    waterQuality,
    waterIncidents,
    riverWidthsByOsmId,
    error,
    loading,
  }
}
