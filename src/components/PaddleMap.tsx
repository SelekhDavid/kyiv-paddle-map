import {
  MapContainer,
  TileLayer,
  Polygon,
  Polyline,
  CircleMarker,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import L from 'leaflet'
import type {
  ClassificationDoc,
  Filters,
  HydroPostMarker,
  PaddleVerdict,
  RestrictionLevel,
  RiverHazard,
  RiverWidthOsmEntry,
  Spot,
  WaterIncident,
  WaterQualitySiteMarker,
  WaterShapeFeature,
} from '../types'
import {
  arrowStepKm,
  capFlowArrows,
  flowArrowSamplesByKm,
  haversineKm,
  isRiverishKind,
  matchSpotToShape,
  paddleShapeStyle,
  riverNameToken,
  shapeStyle,
  hasDisplayableWidth,
  spotMatchedOsmIds,
  widthShapeStyle,
  type FlowArrow,
} from '../lib/geo'
import {
  loadDots,
  DETAIL_RIVER_SWATCH,
  HAZARD_COLORS,
  HAZARD_KIND_LABELS,
  INCIDENT_COLORS,
  INCIDENT_STATUS_LABELS,
  PADDLE_LABELS,
  RESTRICTION_LABELS,
  WATER_QUALITY_COLORS,
  WATER_QUALITY_LABELS,
} from '../lib/labels'
import { isPaddleMapRestriction } from '../lib/paddleReports'
import { osmRiverSpotId, parseOsmRiverSpotId } from '../lib/mapExtent'
import 'leaflet/dist/leaflet.css'

const KYIV: [number, number] = [50.45, 30.52]
const FLOW_ZOOM_MIN = 11
const FULL_RIVER_ZOOM_MIN = 10
const HAZARD_ZOOM_MIN = 10
const HAZARD_MINOR_ZOOM_MIN = 12
const HYDRO_ZOOM_MIN = 9
const WQ_ZOOM_MIN = 10
const INCIDENT_ZOOM_MIN = 9
const ARROW_CAP = 100
const MINOR_HAZARD_KINDS = new Set(['culvert', 'drain', 'ditch'])
const HYDRO_TEAL = '#0d9488'

const canvasRenderer = L.canvas({ padding: 0.5 })

type ViewState = { zoom: number; bounds: L.LatLngBounds | null }

function FlyToSelected({ spot }: { spot: Spot | null }) {
  const map = useMap()
  const spotId = spot?.id
  const lat = spot?.lat
  const lng = spot?.lng
  const kind = spot?.kind
  useEffect(() => {
    if (spotId == null || lat == null || lng == null) return
    const zoom = /river|bay|channel/i.test(kind || '') ? 11 : 13
    map.flyTo([lat, lng], zoom, { duration: 0.75 })
  }, [spotId, lat, lng, kind, map])
  return null
}

function FixMapSize() {
  const map = useMap()
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 80)
    const onResize = () => map.invalidateSize()
    window.addEventListener('resize', onResize)
    return () => {
      window.clearTimeout(id)
      window.removeEventListener('resize', onResize)
    }
  }, [map])
  return null
}

function MapViewTracker({ onChange }: { onChange: Dispatch<SetStateAction<ViewState>> }) {
  const map = useMap()
  useEffect(() => {
    const update = () => onChange({ zoom: map.getZoom(), bounds: map.getBounds() })
    update()
    map.on('zoomend moveend', update)
    return () => {
      map.off('zoomend moveend', update)
    }
  }, [map, onChange])
  return null
}

function ringToLatLngs(ring: number[][]): [number, number][] {
  return ring.map(([lng, lat]) => [lat, lng])
}

function lineToLatLngs(coords: number[][]): [number, number][] {
  return coords.map(([lng, lat]) => [lat, lng])
}

function kindAllowed(kind: string, filters: Filters): boolean {
  const k = kind === 'oxbow' ? 'pond' : /river|bay|channel/i.test(kind) ? 'river' : kind
  if (k in filters.kinds) return filters.kinds[k as keyof Filters['kinds']]
  return filters.kinds.other
}

function passesRestrictionLevel(filters: Filters, level: RestrictionLevel): boolean {
  if (level === 'banned_navigation') return filters.showBanned
  if (level === 'oblast_ban' || level === 'restricted') return filters.showRestricted
  if (level === 'check_local' || level === 'likely_ok') return filters.showCheckLocal
  return true
}

function cacheSet<T>(map: Map<string, T>, key: string, value: T, max = 400): T {
  if (map.size >= max) {
    const first = map.keys().next().value
    if (first !== undefined) map.delete(first)
  }
  map.set(key, value)
  return value
}

function safeCssColor(color: string, fallback: string): string {
  const c = color.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(c)) return c
  if (/^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(c)) return c
  return fallback
}

const arrowIconCache = new Map<string, L.DivIcon>()

function arrowIcon(bearing: number, color: string) {
  const safe = safeCssColor(color, '#d35400')
  const key = `${Math.round(bearing)}|${safe}`
  const cached = arrowIconCache.get(key)
  if (cached) return cached
  const icon = L.divIcon({
    className: 'flow-arrow',
    html: `<svg width="26" height="26" viewBox="0 0 26 26" style="display:block;transform:rotate(${Number(bearing) || 0}deg)" xmlns="http://www.w3.org/2000/svg"><path d="M13 1 L18.2 24 L13 18.5 L7.8 24 Z" fill="${safe}" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
  return cacheSet(arrowIconCache, key, icon)
}

const hydroIconCache = new Map<string, L.DivIcon>()

/** Teal diamond gauge; optional cm label — distinct from orange hazard circles. */
function hydroPostIcon(levelCm: number | null) {
  const key = levelCm != null && Number.isFinite(levelCm) ? String(Math.round(levelCm)) : 'na'
  const cached = hydroIconCache.get(key)
  if (cached) return cached
  const label =
    levelCm != null && Number.isFinite(levelCm)
      ? `<span class="hydro-post-label">${Math.round(levelCm)}</span>`
      : ''
  const icon = L.divIcon({
    className: 'hydro-post-marker',
    html: `<div class="hydro-post-inner" title="Гідропост">${label}<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 1.5 L16.5 9 L9 16.5 L1.5 9 Z" fill="${HYDRO_TEAL}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg></div>`,
    iconSize: [44, 34],
    iconAnchor: [22, 17],
  })
  return cacheSet(hydroIconCache, key, icon)
}

const incidentIconCache = new Map<string, L.DivIcon>()

/** Purple diamond — distinct from teal hydro diamonds and green WQ circles. */
function incidentIcon(color: string) {
  const safe = safeCssColor(color, '#6a1b9a')
  const cached = incidentIconCache.get(safe)
  if (cached) return cached
  const icon = L.divIcon({
    className: 'incident-marker',
    html: `<div class="incident-inner" title="Інцидент"><svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M9 1.5 L16.5 9 L9 16.5 L1.5 9 Z" fill="${safe}" stroke="#fff" stroke-width="1.4" stroke-linejoin="round"/></svg></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
  return cacheSet(incidentIconCache, safe, icon)
}

function formatHydroObservedAt(iso: string | null): string {
  if (!iso) return 'час невідомий'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return d.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function lineTouchesBounds(latlngs: [number, number][], bounds: L.LatLngBounds | null): boolean {
  if (!bounds || latlngs.length === 0) return true
  const pad = bounds.pad(0.15)
  for (const [lat, lng] of latlngs) {
    if (pad.contains(L.latLng(lat, lng))) return true
  }
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const [lat, lng] of latlngs) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
  }
  return pad.intersects(L.latLngBounds([minLat, minLng], [maxLat, maxLng]))
}

function resolveRiverLevel(
  osmId: string,
  spot: Spot | null,
  classification: ClassificationDoc | null,
): RestrictionLevel {
  // Per-segment classification wins — never paint a whole river from one nearby spot
  const entry = classification?.features[osmId]
  if (entry?.level) return entry.level
  if (spot?.restriction.level) return spot.restriction.level
  return 'likely_ok'
}

/** Unique osmId only — geometric proximity dedupe was O(n²) and blocked the UI. */
function dedupeRiverLines(
  items: Array<{
    f: WaterShapeFeature & { geometry: { type: 'LineString'; coordinates: number[][] } }
    latlngs: [number, number][]
    spot: Spot | null
  }>,
): typeof items {
  const seenOsm = new Set<string>()
  const out: typeof items = []
  for (const item of items) {
    const osmId = item.f.properties.osmId
    if (seenOsm.has(osmId)) continue
    seenOsm.add(osmId)
    out.push(item)
  }
  return out
}

interface Props {
  /** Filtered spots (markers / list-visible layers) */
  spots: Spot[]
  /** Full catalog for OSM matching indexes (not filter-dependent) */
  allSpots: Spot[]
  shapes: WaterShapeFeature[]
  classification: ClassificationDoc | null
  paddleByToken: Record<string, PaddleVerdict>
  hazards: RiverHazard[]
  hydroPosts: HydroPostMarker[]
  waterQuality: WaterQualitySiteMarker[]
  waterIncidents: WaterIncident[]
  riverWidthsByOsmId: Record<string, RiverWidthOsmEntry>
  filters: Filters
  selectedId: string | null
  /** Full selection (incl. ephemeral osm-river-*), for fly-to */
  selectedSpot: Spot | null
  onSelect: (id: string) => void
}

export function PaddleMap({
  spots,
  allSpots,
  shapes,
  classification,
  paddleByToken,
  hazards,
  hydroPosts,
  waterQuality,
  waterIncidents,
  riverWidthsByOsmId,
  filters,
  selectedId,
  selectedSpot,
  onSelect,
}: Props) {
  const [view, setView] = useState<ViewState>({ zoom: 9, bounds: null })
  const paddleMode = filters.mapMode === 'paddle'
  const detailMode = filters.mapMode === 'detail'

  const resolvePaddleVerdict = (
    f: WaterShapeFeature,
    spot: Spot | null,
  ): PaddleVerdict | undefined => {
    if (spot?.paddleVerdict) return spot.paddleVerdict
    const n = f.properties.nameUk || f.properties.name || ''
    const token = riverNameToken(n)
    return token ? paddleByToken[token] : undefined
  }

  const spotByOsm = useMemo(() => {
    const m = new Map<string, Spot>()
    // Explicit primary + cascade group ids first
    for (const s of allSpots) {
      for (const id of spotMatchedOsmIds(s)) m.set(id, s)
    }
    for (const s of allSpots) {
      if (spotMatchedOsmIds(s).length) continue
      const hit = matchSpotToShape(s, shapes)
      if (hit) m.set(hit.properties.osmId, s)
    }
    // Index river shapes by name token — avoid O(spots × shapes) scans
    const riversByToken = new Map<string, WaterShapeFeature[]>()
    for (const f of shapes) {
      if (f.properties.kind !== 'river') continue
      const n = f.properties.nameUk || f.properties.name || ''
      const token = riverNameToken(n)
      if (token.length < 4) continue
      const list = riversByToken.get(token)
      if (list) list.push(f)
      else riversByToken.set(token, [f])
    }
    const SPOT_NAME_BIND_KM = 25
    for (const s of allSpots) {
      if (!isRiverishKind(s.kind)) continue
      const hintToken = riverNameToken(s.osmHint || s.nameUk)
      if (hintToken.length < 4) continue
      const candidates = riversByToken.get(hintToken)
      if (!candidates) continue
      for (const f of candidates) {
        if (m.has(f.properties.osmId)) continue
        const lat = f.properties.lat
        const lng = f.properties.lng
        if (lat == null || lng == null) continue
        if (haversineKm(s, { lat, lng }) > SPOT_NAME_BIND_KM) continue
        m.set(f.properties.osmId, s)
      }
    }
    // Bind reservoir/lake MultiPolygons by name token (cascade bans; ~40 km).
    // Skip spots that already have an explicit/matched group — avoids Редькине→Міністерське.
    const polysByToken = new Map<string, WaterShapeFeature[]>()
    for (const f of shapes) {
      if (f.geometry.type === 'LineString') continue
      const n = f.properties.nameUk || f.properties.name || ''
      const token = riverNameToken(n)
      if (token.length < 4) continue
      const list = polysByToken.get(token)
      if (list) list.push(f)
      else polysByToken.set(token, [f])
    }
    const POLY_NAME_BIND_KM = 40
    for (const s of allSpots) {
      if (isRiverishKind(s.kind)) continue
      if (spotMatchedOsmIds(s).length) continue
      const hintToken = riverNameToken(s.osmHint || s.nameUk)
      if (hintToken.length < 4) continue
      const candidates = polysByToken.get(hintToken)
      if (!candidates) continue
      for (const f of candidates) {
        if (m.has(f.properties.osmId)) continue
        const lat = f.properties.lat
        const lng = f.properties.lng
        if (lat == null || lng == null) continue
        if (haversineKm(s, { lat, lng }) > POLY_NAME_BIND_KM) continue
        m.set(f.properties.osmId, s)
      }
    }
    return m
  }, [allSpots, shapes])

  const visibleSpotIds = useMemo(() => new Set(spots.map((s) => s.id)), [spots])

  const visibleShapes = useMemo(() => {
    const lowZoom = view.zoom < FULL_RIVER_ZOOM_MIN
    return shapes.filter((f) => {
      if (!kindAllowed(f.properties.kind, filters)) return false
      const isPoly =
        f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      const isRiverLine = f.geometry.type === 'LineString' && f.properties.kind === 'river'

      if (paddleMode) {
        if (isPoly) {
          if (!filters.showAllShapes) return false
          const spot = spotByOsm.get(f.properties.osmId)
          if (!spot?.paddleVerdict) return false
          if (!isPaddleMapRestriction(spot.restriction.level)) return false
          return visibleSpotIds.has(spot.id)
        }
        if (isRiverLine) {
          const spot = spotByOsm.get(f.properties.osmId) ?? null
          if (spot) {
            if (!spot.paddleVerdict || !isPaddleMapRestriction(spot.restriction.level)) return false
            return visibleSpotIds.has(spot.id)
          }
          const n = f.properties.nameUk || f.properties.name || ''
          const token = riverNameToken(n)
          const verdict = token ? paddleByToken[token] : undefined
          if (!verdict) return false
          const level = resolveRiverLevel(f.properties.osmId, null, classification)
          return isPaddleMapRestriction(level)
        }
        return false
      }

      // restrictions + detail
      if (isPoly) {
        if (!filters.showAllShapes) return false
        // methodology: unmatched polys are not product paint (no gray orphans)
        const spot = spotByOsm.get(f.properties.osmId) ?? null
        if (!spot) return false
        if (detailMode) {
          const level = resolveRiverLevel(f.properties.osmId, spot, classification)
          if (level === 'banned_navigation') return false
          return visibleSpotIds.has(spot.id)
        }
        if (spot.touristLoad.grade > filters.maxTouristLoad) return false
        if (!passesRestrictionLevel(filters, spot.restriction.level)) return false
        return visibleSpotIds.has(spot.id)
      }

      if (isRiverLine) {
        if (detailMode) {
          const widthM = riverWidthsByOsmId[f.properties.osmId]?.widthM
          if (!hasDisplayableWidth(widthM)) return false
          const spot = spotByOsm.get(f.properties.osmId) ?? null
          const level = resolveRiverLevel(f.properties.osmId, spot, classification)
          if (level === 'banned_navigation') return false
          if (spot) return visibleSpotIds.has(spot.id)
          return filters.kinds.river
        }
        const spot = spotByOsm.get(f.properties.osmId) ?? null
        const level = resolveRiverLevel(f.properties.osmId, spot, classification)
        if (!passesRestrictionLevel(filters, level)) return false
        if (spot) {
          if (spot.touristLoad.grade > filters.maxTouristLoad) return false
          return visibleSpotIds.has(spot.id)
        }
        if (lowZoom) return false
        return filters.kinds.river
      }

      return false
    })
  }, [
    shapes,
    filters,
    spotByOsm,
    visibleSpotIds,
    view.zoom,
    classification,
    paddleMode,
    detailMode,
    paddleByToken,
    riverWidthsByOsmId,
  ])

  const riverLayers = useMemo(() => {
    const raw = visibleShapes
      .filter(
        (f): f is WaterShapeFeature & { geometry: { type: 'LineString'; coordinates: number[][] } } =>
          f.geometry.type === 'LineString',
      )
      .map((f) => {
        const latlngs = lineToLatLngs(f.geometry.coordinates)
        const spot = spotByOsm.get(f.properties.osmId) ?? null
        return { f, latlngs, spot }
      })
      .filter(({ latlngs }) => lineTouchesBounds(latlngs, view.bounds))

    return dedupeRiverLines(raw)
  }, [visibleShapes, view.bounds, spotByOsm])

  const flowArrows = useMemo(() => {
    if (!filters.showFlow || view.zoom < FLOW_ZOOM_MIN) {
      return [] as Array<FlowArrow & { color: string; key: string }>
    }

    const padBounds = view.bounds?.pad(0.1) ?? null
    const step = arrowStepKm(view.zoom)
    const collected: Array<FlowArrow & { color: string }> = []

    for (const { f, latlngs, spot } of riverLayers) {
      let color = '#d35400'
      if (detailMode) {
        color = DETAIL_RIVER_SWATCH
      } else if (paddleMode) {
        const verdict = resolvePaddleVerdict(f, spot)
        color = verdict === 'negative' ? '#95a5a6' : '#2980b9'
      } else {
        const level = resolveRiverLevel(f.properties.osmId, spot, classification)
        color =
          shapeStyle(level, spot?.id === selectedId, 'river', view.zoom).color || '#d35400'
      }
      const samples = flowArrowSamplesByKm(latlngs, step, padBounds)
      for (const s of samples) collected.push({ ...s, color })
    }

    const capped = capFlowArrows(collected, padBounds, ARROW_CAP)
    return capped.map((a, i) => ({
      ...a,
      key: `fa-${i}-${a.lat.toFixed(4)}-${a.lng.toFixed(4)}`,
    }))
  }, [
    filters.showFlow,
    view.zoom,
    view.bounds,
    riverLayers,
    classification,
    selectedId,
    paddleMode,
    detailMode,
    paddleByToken,
  ])

  const visibleHostRiverIds = useMemo(() => {
    const ids = new Set<string>()
    for (const { f } of riverLayers) ids.add(f.properties.osmId)
    return ids
  }, [riverLayers])

  /** Hosts in view for hazard overlays — not gated by displayable width (unlike riverLayers in detail). */
  const hazardHostRiverIds = useMemo(() => {
    if (!detailMode) return visibleHostRiverIds
    const pad = view.bounds
    const ids = new Set<string>()
    for (const f of shapes) {
      if (f.geometry.type !== 'LineString' || f.properties.kind !== 'river') continue
      if (!kindAllowed(f.properties.kind, filters)) continue
      const spot = spotByOsm.get(f.properties.osmId) ?? null
      const level = resolveRiverLevel(f.properties.osmId, spot, classification)
      if (level === 'banned_navigation') continue
      const latlngs = lineToLatLngs(f.geometry.coordinates)
      if (!lineTouchesBounds(latlngs, pad)) continue
      ids.add(f.properties.osmId)
    }
    return ids
  }, [
    detailMode,
    visibleHostRiverIds,
    shapes,
    filters,
    spotByOsm,
    classification,
    view.bounds,
  ])

  const hazardsByHost = useMemo(() => {
    const m = new Map<string, RiverHazard[]>()
    for (const h of hazards) {
      const list = m.get(h.hostRiverOsmId)
      if (list) list.push(h)
      else m.set(h.hostRiverOsmId, [h])
    }
    return m
  }, [hazards])

  const detailLayersOn = detailMode

  const visibleHazards = useMemo(() => {
    if (!detailLayersOn || !filters.showHazards || view.zoom < HAZARD_ZOOM_MIN) {
      return [] as RiverHazard[]
    }
    const pad = view.bounds?.pad(0.05) ?? null
    const allowMinor = view.zoom >= HAZARD_MINOR_ZOOM_MIN
    const out: RiverHazard[] = []
    for (const hostId of hazardHostRiverIds) {
      const list = hazardsByHost.get(hostId)
      if (!list) continue
      for (const h of list) {
        if (!allowMinor && MINOR_HAZARD_KINDS.has(h.kind)) continue
        if (pad && !pad.contains(L.latLng(h.lat, h.lng))) continue
        out.push(h)
        if (out.length >= 400) return out
      }
    }
    return out
  }, [
    detailLayersOn,
    filters.showHazards,
    view.zoom,
    view.bounds,
    hazardsByHost,
    hazardHostRiverIds,
  ])

  const visibleHydroPosts = useMemo(() => {
    if (!detailLayersOn || !filters.showHydroPosts || view.zoom < HYDRO_ZOOM_MIN) {
      return [] as HydroPostMarker[]
    }
    const pad = view.bounds?.pad(0.05) ?? null
    const out: HydroPostMarker[] = []
    for (const p of hydroPosts) {
      if (pad && !pad.contains(L.latLng(p.lat, p.lng))) continue
      out.push(p)
    }
    return out.slice(0, 200)
  }, [detailLayersOn, filters.showHydroPosts, view.zoom, view.bounds, hydroPosts])

  const visibleWaterQuality = useMemo(() => {
    if (!detailLayersOn || !filters.showWaterQuality || view.zoom < WQ_ZOOM_MIN) {
      return [] as WaterQualitySiteMarker[]
    }
    const pad = view.bounds?.pad(0.05) ?? null
    const out: WaterQualitySiteMarker[] = []
    for (const site of waterQuality) {
      if (site.lat == null || site.lng == null) continue
      if (pad && !pad.contains(L.latLng(site.lat, site.lng))) continue
      out.push(site)
    }
    return out.slice(0, 200)
  }, [detailLayersOn, filters.showWaterQuality, view.zoom, view.bounds, waterQuality])

  const visibleIncidents = useMemo(() => {
    if (!detailLayersOn || !filters.showIncidents || view.zoom < INCIDENT_ZOOM_MIN) {
      return [] as WaterIncident[]
    }
    const pad = view.bounds?.pad(0.05) ?? null
    const out: WaterIncident[] = []
    for (const inc of waterIncidents) {
      if (inc.lat == null || inc.lng == null) continue
      if (pad && !pad.contains(L.latLng(inc.lat, inc.lng))) continue
      out.push(inc)
    }
    return out.slice(0, 100)
  }, [detailLayersOn, filters.showIncidents, view.zoom, view.bounds, waterIncidents])

  const showTooltips = view.zoom >= FLOW_ZOOM_MIN || paddleMode || detailMode

  return (
    <MapContainer center={KYIV} zoom={9} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <FixMapSize />
      <MapViewTracker onChange={setView} />
      <FlyToSelected spot={selectedSpot} />

      {riverLayers.map(({ f, latlngs, spot }) => {
        const selectId = spot?.id ?? osmRiverSpotId(f.properties.osmId)
        const selectedShape =
          selectId === selectedId ||
          (selectedId != null && parseOsmRiverSpotId(selectedId) === f.properties.osmId)
        const verdict = resolvePaddleVerdict(f, spot)
        const level = resolveRiverLevel(f.properties.osmId, spot, classification)
        const widthM = riverWidthsByOsmId[f.properties.osmId]?.widthM ?? null
        const style = detailMode
          ? widthShapeStyle(widthM, selectedShape, 'river', view.zoom)
          : paddleMode
            ? paddleShapeStyle(verdict || 'ok', selectedShape, 'river', view.zoom)
            : shapeStyle(level, selectedShape, 'river', view.zoom)
        const entry = classification?.features[f.properties.osmId]
        const title =
          spot?.nameUk || entry?.name || f.properties.nameUk || f.properties.name || 'Річка'
        const widthLabel =
          widthM != null && Number.isFinite(widthM) ? `≈ ${Math.round(widthM)} м` : 'ширина невідома'

        return (
          <Polyline
            key={f.properties.osmId}
            positions={latlngs}
            pathOptions={style}
            renderer={canvasRenderer}
            eventHandlers={{
              click: () => onSelect(selectId),
            }}
          >
            {showTooltips && (
              <Tooltip sticky>
                {title}
                {detailMode ? ` · ${widthLabel}` : ''}
                {paddleMode && verdict ? ` · ${PADDLE_LABELS[verdict]}` : ''}
                {!paddleMode && !detailMode && entry ? ` · ${RESTRICTION_LABELS[entry.level]}` : ''}
                {f.properties.flow ? ' · течія →' : ''}
              </Tooltip>
            )}
            <Popup>
              <strong>{title}</strong>
              <br />
              {detailMode
                ? widthLabel
                : paddleMode && verdict
                  ? PADDLE_LABELS[verdict]
                  : spot?.restriction.labelUk ||
                    (entry ? entry.reasonUk.slice(0, 160) : 'Ділянка річки')}
              {!detailMode && spot ? (
                <>
                  <br />
                  Наскільки людне: {loadDots(spot.touristLoad.grade)}
                </>
              ) : null}
              {!detailMode && classification?.checkedAt ? (
                <>
                  <br />
                  Перевірено станом на {classification.checkedAt}
                </>
              ) : null}
            </Popup>
          </Polyline>
        )
      })}

      {flowArrows.map((a) => (
        <Marker
          key={a.key}
          position={[a.lat, a.lng]}
          icon={arrowIcon(a.bearing, a.color)}
          interactive={false}
        />
      ))}

      {filters.showAllShapes &&
        visibleShapes
          .filter((f) => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
          .map((f) => {
            const spot = spotByOsm.get(f.properties.osmId) ?? null
            const selectedShape = spot?.id === selectedId
            const verdict = spot?.paddleVerdict
            const level = spot?.restriction.level ?? null
            const widthM = riverWidthsByOsmId[f.properties.osmId]?.widthM ?? null
            const style = detailMode
              ? widthShapeStyle(widthM, selectedShape, f.properties.kind, view.zoom)
              : paddleMode && verdict
                ? paddleShapeStyle(verdict, selectedShape, f.properties.kind, view.zoom)
                : shapeStyle(level, selectedShape, f.properties.kind, view.zoom)
            const title = spot?.nameUk || f.properties.nameUk || f.properties.name || 'Водойма'
            const onClick = () => {
              if (spot) onSelect(spot.id)
            }

            if (f.geometry.type === 'Polygon') {
              return (
                <Polygon
                  key={f.properties.osmId}
                  positions={ringToLatLngs(f.geometry.coordinates[0])}
                  pathOptions={style}
                  renderer={canvasRenderer}
                  eventHandlers={{ click: onClick }}
                >
                  {showTooltips && <Tooltip sticky>{title}</Tooltip>}
                </Polygon>
              )
            }

            if (f.geometry.type !== 'MultiPolygon') return null
            const rings = f.geometry.coordinates
            return rings.map((poly, idx) => (
              <Polygon
                key={`${f.properties.osmId}-${idx}`}
                positions={ringToLatLngs(poly[0] as number[][])}
                pathOptions={style}
                renderer={canvasRenderer}
                eventHandlers={{ click: onClick }}
              >
                {showTooltips && <Tooltip sticky>{title}</Tooltip>}
              </Polygon>
            ))
          })}

      {!filters.showAllShapes &&
        spots.map((spot) => {
          if (/river|bay|channel/i.test(spot.kind)) return null
          if (detailMode && spot.restriction.level === 'banned_navigation') return null
          const isSelected = spot.id === selectedId
          const color = detailMode
            ? DETAIL_RIVER_SWATCH
            : paddleMode && spot.paddleVerdict
              ? paddleShapeStyle(spot.paddleVerdict, isSelected, 'lake', view.zoom).fillColor
              : shapeStyle(spot.restriction.level, isSelected, 'lake', view.zoom).fillColor ||
                '#6a9bb8'
          return (
            <CircleMarker
              key={`anchor-${spot.id}`}
              center={[spot.lat, spot.lng]}
              radius={isSelected ? 8 : 5}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.75,
                weight: 1.5,
              }}
              renderer={canvasRenderer}
              eventHandlers={{ click: () => onSelect(spot.id) }}
            >
              <Tooltip direction="top">{spot.nameUk}</Tooltip>
            </CircleMarker>
          )
        })}

      {visibleHazards.map((h) => {
        const major = !MINOR_HAZARD_KINDS.has(h.kind)
        const title = h.name ? `${h.labelUk}: ${h.name}` : h.labelUk
        const host = h.hostRiverName ? ` · ${h.hostRiverName}` : ''
        return (
          <CircleMarker
            key={h.id}
            center={[h.lat, h.lng]}
            radius={major ? 5 : 3.5}
            pathOptions={{
              color: HAZARD_COLORS.stroke,
              fillColor: major ? HAZARD_COLORS.major : HAZARD_COLORS.minor,
              fillOpacity: 0.92,
              weight: 1.1,
            }}
            renderer={canvasRenderer}
          >
            <Tooltip sticky>
              {title}
              {host}
              <br />
              {HAZARD_KIND_LABELS[h.kind] || h.labelUk}
            </Tooltip>
          </CircleMarker>
        )
      })}

      {visibleHydroPosts.map((p) => {
        const levelText =
          p.levelCm != null && Number.isFinite(p.levelCm)
            ? `${Math.round(p.levelCm)} см`
            : 'рівень невідомий'
        const river = p.riverUk ? ` · ${p.riverUk}` : ''
        return (
          <Marker
            key={`hydro-${p.id}`}
            position={[p.lat, p.lng]}
            icon={hydroPostIcon(p.levelCm)}
            zIndexOffset={300}
          >
            <Tooltip sticky>
              Гідропост {p.nameUk}
              {river}
              <br />
              {levelText}
            </Tooltip>
            <Popup>
              <strong>{p.nameUk}</strong>
              {p.riverUk ? (
                <>
                  <br />
                  Річка: {p.riverUk}
                </>
              ) : null}
              <br />
              Рівень: {levelText}
              {p.changeCm != null ? (
                <>
                  <br />
                  Зміна за добу: {p.changeCm > 0 ? '+' : ''}
                  {p.changeCm} см
                </>
              ) : null}
              {p.tempC != null ? (
                <>
                  <br />
                  Температура води: {p.tempC} °C
                </>
              ) : null}
              <br />
              Спостереження: {formatHydroObservedAt(p.observedAt)}
              <br />
              <small>{p.kind === 'auto' ? 'Автоматичний пост' : 'Щоденна мережа'}</small>
              {p.sourceUrl ? (
                <>
                  <br />
                  <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                    Джерело (УкрГМЦ)
                  </a>
                </>
              ) : null}
            </Popup>
          </Marker>
        )
      })}

      {visibleWaterQuality.map((site) => {
        if (site.lat == null || site.lng == null) return null
        const color = WATER_QUALITY_COLORS[site.status] || WATER_QUALITY_COLORS.unknown
        const label = WATER_QUALITY_LABELS[site.status] || site.status
        return (
          <CircleMarker
            key={`wq-${site.id}`}
            center={[site.lat, site.lng]}
            radius={6}
            pathOptions={{
              color: '#fff',
              fillColor: color,
              fillOpacity: 0.92,
              weight: 1.5,
            }}
            renderer={canvasRenderer}
            eventHandlers={{
              click: () => {
                const sid = site.spotId || site.spotIds?.[0]
                if (sid) onSelect(sid)
              },
            }}
          >
            <Tooltip sticky>
              {site.nameUk}
              <br />
              {label}
              {site.sampledAt ? ` · ${site.sampledAt.slice(0, 10)}` : ''}
            </Tooltip>
            <Popup>
              <strong>{site.nameUk}</strong>
              <br />
              {label}
              {site.metricsNoteUk ? (
                <>
                  <br />
                  {site.metricsNoteUk}
                </>
              ) : null}
              {site.waterBodyUk ? (
                <>
                  <br />
                  Водойма: {site.waterBodyUk}
                </>
              ) : null}
              {site.sourceUrls?.[0] ? (
                <>
                  <br />
                  <a href={site.sourceUrls[0]} target="_blank" rel="noreferrer">
                    Джерело
                  </a>
                </>
              ) : null}
            </Popup>
          </CircleMarker>
        )
      })}

      {visibleIncidents.map((inc) => {
        if (inc.lat == null || inc.lng == null) return null
        const color = INCIDENT_COLORS[inc.severity] || INCIDENT_COLORS.medium
        const st = INCIDENT_STATUS_LABELS[inc.status] || inc.status
        return (
          <Marker
            key={`inc-${inc.id}`}
            position={[inc.lat, inc.lng]}
            icon={incidentIcon(color)}
            zIndexOffset={400}
            eventHandlers={{
              click: () => {
                const sid = inc.spotIds?.[0]
                if (sid) onSelect(sid)
              },
            }}
          >
            <Tooltip sticky>
              Інцидент: {inc.titleUk}
              <br />
              {st}
            </Tooltip>
            <Popup>
              <strong>{inc.titleUk}</strong>
              <br />
              Статус: {st} · рівень: {inc.severity}
              {inc.waterBodyUk ? (
                <>
                  <br />
                  {inc.waterBodyUk}
                </>
              ) : null}
              {inc.summaryUk ? (
                <>
                  <br />
                  {inc.summaryUk}
                </>
              ) : null}
              {inc.sourceUrls?.[0] ? (
                <>
                  <br />
                  <a href={inc.sourceUrls[0]} target="_blank" rel="noreferrer">
                    Джерело
                  </a>
                </>
              ) : null}
            </Popup>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
