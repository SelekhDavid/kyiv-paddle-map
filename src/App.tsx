import { useEffect, useMemo, useState } from 'react'
import { PaddleMap } from './components/PaddleMap'
import { FilterPanel } from './components/FilterPanel'
import { SpotList } from './components/SpotList'
import { SpotDetail } from './components/SpotDetail'
import { useMapData } from './hooks/useMapData'
import { fitsSearch, kindLabel, regionLabel } from './lib/labels'
import { hasDisplayableWidth } from './lib/geo'
import { isPaddleMapRestriction } from './lib/paddleReports'
import { parseOsmRiverSpotId, spotFromRiverFeature } from './lib/mapExtent'
import type { Filters } from './types'
import './App.css'

const DEFAULT_FILTERS: Filters = {
  mapMode: 'restrictions',
  showBanned: true,
  showRestricted: true,
  showCheckLocal: true,
  showAllShapes: false,
  showFlow: true,
  showHazards: true,
  showHydroPosts: true,
  showWaterQuality: true,
  showIncidents: true,
  maxTouristLoad: 5,
  search: '',
  kinds: {
    lake: true,
    river: true,
    reservoir: true,
    quarry: true,
    pond: true,
    basin: true,
    other: true,
  },
}

function passesRestriction(filters: Filters, level: string): boolean {
  // banned_navigation = black/red cascade bans only
  if (level === 'banned_navigation') return filters.showBanned
  // oblast_ban grouped with "обмежено" so tributaries don't vanish with red cascade filter
  if (level === 'oblast_ban' || level === 'restricted') return filters.showRestricted
  if (level === 'check_local' || level === 'likely_ok') return filters.showCheckLocal
  return true
}

function passesKind(filters: Filters, kind: string): boolean {
  const k = kind === 'oxbow' ? 'pond' : /river|bay|channel/i.test(kind) ? 'river' : kind
  if (k in filters.kinds) return filters.kinds[k as keyof Filters['kinds']]
  return filters.kinds.other
}

export default function App() {
  const {
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
  } = useMapData()
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const onFiltersChange = (next: Filters) => {
    if (next.mapMode !== filters.mapMode) setSelectedId(null)
    setFilters(next)
  }

  const visible = useMemo(() => {
    return spots.filter((s) => {
      if (filters.mapMode === 'paddle') {
        if (!s.paddleVerdict) return false
        if (!isPaddleMapRestriction(s.restriction.level)) return false
      } else if (filters.mapMode === 'detail') {
        if (s.restriction.level === 'banned_navigation') return false
        if (/river|bay|channel/i.test(s.kind)) {
          const w = s.matchedOsmId ? riverWidthsByOsmId[s.matchedOsmId]?.widthM : null
          if (!hasDisplayableWidth(w)) return false
        }
      } else if (filters.mapMode === 'restrictions') {
        if (!passesRestriction(filters, s.restriction.level)) return false
        if ((s.touristLoad?.grade ?? 5) > filters.maxTouristLoad) return false
      }
      if (!passesKind(filters, s.kind)) return false
      const hay = `${s.nameUk} ${s.nameEn} ${s.region} ${regionLabel(s.region)} ${s.kind} ${kindLabel(s.kind)}`
      return fitsSearch(hay, filters.search)
    })
  }, [spots, filters, riverWidthsByOsmId])

  useEffect(() => {
    if (!selectedId) return
    if (parseOsmRiverSpotId(selectedId)) return
    if (!visible.some((s) => s.id === selectedId)) setSelectedId(null)
  }, [visible, selectedId])

  const selected = useMemo(() => {
    if (!selectedId) return null
    const fromVisible = visible.find((s) => s.id === selectedId)
    if (fromVisible) return fromVisible
    const osmId = parseOsmRiverSpotId(selectedId)
    if (!osmId || !shapes) return null
    const f = shapes.features.find((x) => x.properties.osmId === osmId)
    if (!f) return null
    return spotFromRiverFeature(f, classification)
  }, [selectedId, visible, shapes, classification])
  const shapeFeatures = shapes?.features ?? []
  const checkedAt = classification?.checkedAt ?? null

  const listTotalCount = useMemo(() => {
    if (filters.mapMode === 'paddle') {
      return spots.filter((s) => s.paddleVerdict && isPaddleMapRestriction(s.restriction.level)).length
    }
    if (filters.mapMode === 'detail') {
      return spots.filter((s) => {
        if (s.restriction.level === 'banned_navigation') return false
        if (/river|bay|channel/i.test(s.kind)) {
          const w = s.matchedOsmId ? riverWidthsByOsmId[s.matchedOsmId]?.widthM : null
          if (!hasDisplayableWidth(w)) return false
        }
        return true
      }).length
    }
    return spots.length
  }, [spots, filters.mapMode, riverWidthsByOsmId])

  const linkedQuality = useMemo(() => {
    if (!selected) return []
    return waterQuality.filter(
      (s) =>
        s.spotId === selected.id ||
        (s.spotIds && s.spotIds.includes(selected.id)) ||
        (selected.matchedOsmId != null && s.hostRiverOsmId === selected.matchedOsmId),
    )
  }, [selected, waterQuality])

  const linkedIncidents = useMemo(() => {
    if (!selected) return []
    return waterIncidents.filter(
      (inc) =>
        (inc.spotIds && inc.spotIds.includes(selected.id)) ||
        (selected.matchedOsmId != null && inc.hostRiverOsmId === selected.matchedOsmId),
    )
  }, [selected, waterIncidents])

  const selectedWidthM =
    selected?.matchedOsmId != null
      ? (riverWidthsByOsmId[selected.matchedOsmId]?.widthM ?? null)
      : null

  return (
    <div className="app">
      <header className="top">
        <div>
          <p className="eyebrow">Київська область · контури водойм · напрям течії</p>
          <h1>Мапа водойм для SUP і плавання</h1>
        </div>
        <p className="warn">
          {filters.mapMode === 'paddle' ? (
            <>
              Тут лише водойми без червоної заборони навігації, і лише якщо є свіжі згадки з 2023
              року й пізніше (тури, прокат, звіти). Синій — люди тут плавають; сірий — у свіжих
              відгуках сплав описують як проблемний. Це не дозвіл вийти на воду.
            </>
          ) : filters.mapMode === 'detail' ? (
            <>
              Режим «детально»: сині річки з оцінкою ширини більше 1 м (без OSM «1 м» і без червоних
              заборон навігації). Кружечки — проби Плесо/МОЗ; фіолетові ромби — інциденти; темні точки —
              дамби й інші перешкоди. Це довідка, не дозвіл виходити на воду.
            </>
          ) : (
            <>
              На водоймах Київщини під час воєнного стану діє заборона цивільної навігації. Колір на
              карті показує, що відомо про місцеві правила громад і каскад Дніпра. Мапа не дає дозволу
              виходити на воду — перед виходом перевірте офіційні джерела.
            </>
          )}
          {filters.mapMode !== 'detail' && checkedAt ? (
            <> Дані перевірені станом на {checkedAt}.</>
          ) : null}
        </p>
      </header>

      {loading && <div className="banner">Завантаження…</div>}
      {error && <div className="banner error">{error}</div>}
      {!loading && !shapes && (
        <div className="banner error">
          Немає файлу з контурами водойм. Запустіть <code>npm run fetch-shapes</code>
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <FilterPanel
            filters={filters}
            onChange={onFiltersChange}
            shapeCount={shapeFeatures.length}
            visibleCount={visible.length}
            totalCount={listTotalCount}
          />
          <SpotList
            spots={visible}
            selectedId={selectedId}
            onSelect={setSelectedId}
            mapMode={filters.mapMode}
          />
        </aside>

        <main className="map-wrap">
          <PaddleMap
            spots={visible}
            allSpots={spots}
            shapes={shapeFeatures}
            classification={classification}
            paddleByToken={paddleByToken}
            hazards={hazards}
            hydroPosts={hydroPosts}
            waterQuality={waterQuality}
            waterIncidents={waterIncidents}
            riverWidthsByOsmId={riverWidthsByOsmId}
            filters={filters}
            selectedId={selectedId}
            selectedSpot={selected}
            onSelect={setSelectedId}
          />
        </main>

        <SpotDetail
          spot={selected}
          rules={rules}
          checkedAt={checkedAt}
          mapMode={filters.mapMode}
          widthM={selectedWidthM}
          waterQuality={linkedQuality}
          incidents={linkedIncidents}
          onClose={() => setSelectedId(null)}
        />
      </div>

      {rules && (
        <footer className="foot">
          <details>
            <summary>Правила регіону та як оцінено людність місць</summary>
            <ul className="rules">
              {rules.regionalRules.map((r) => (
                <li key={r.id}>
                  <strong>{r.titleUk}</strong>
                  <p>{r.summaryUk}</p>
                  <p>
                    {r.sources.map((s) => (
                      <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                        {s.title}
                      </a>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
            <p className="method">{rules.touristLoadMethod.approachUk}</p>
            <p className="meta">
              Оновлено: {rules.updated}
              {filters.mapMode !== 'detail' && checkedAt
                ? ` · статуси річок станом на ${checkedAt}`
                : ''}
              {' · '}контури: OpenStreetMap
            </p>
          </details>
        </footer>
      )}
    </div>
  )
}
