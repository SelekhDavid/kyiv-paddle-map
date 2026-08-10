<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import { Protocol } from 'pmtiles'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import type { RestrictionLevel, Spot } from '../lib/types'
  import { absoluteDataUrl } from '../lib/dataUrl'
  import { isStandingWaterKind, spotMatchedOsmIds } from '../lib/geo'
  import { MAP_CENTER, MAP_EXTENT, MAP_ZOOM } from '../lib/mapExtent'
  import { RESTRICTION_COLORS } from '../lib/labels'

  interface Props {
    spots: Spot[]
    selectedId: string | null
    onSelect: (id: string | null) => void
  }

  let { spots, selectedId, onSelect }: Props = $props()

  let container: HTMLDivElement
  let map: maplibregl.Map | null = null
  let protocol: Protocol | null = null
  let ready = $state(false)
  let mapError = $state<string | null>(null)
  let hoverOsmId: string | null = null

  const POLY: maplibregl.FilterSpecification = [
    'any',
    ['==', ['geometry-type'], 'Polygon'],
    ['==', ['geometry-type'], 'MultiPolygon'],
  ]
  const LINE: maplibregl.FilterSpecification = [
    'any',
    ['==', ['geometry-type'], 'LineString'],
    ['==', ['geometry-type'], 'MultiLineString'],
  ]

  const INTERACTIVE = ['water-fill', 'water-outline', 'water-line-bound'] as const

  function osmToSpot(list: Spot[]): Map<string, Spot> {
    const m = new Map<string, Spot>()
    for (const s of list) {
      for (const id of spotMatchedOsmIds(s)) m.set(id, s)
    }
    return m
  }

  function standingIds(list: Spot[]): string[] {
    const ids: string[] = []
    for (const s of list) {
      if (!isStandingWaterKind(s.kind)) continue
      ids.push(...spotMatchedOsmIds(s))
    }
    return [...new Set(ids)]
  }

  function riverIds(list: Spot[]): string[] {
    const ids: string[] = []
    for (const s of list) {
      if (isStandingWaterKind(s.kind)) continue
      ids.push(...spotMatchedOsmIds(s))
    }
    return [...new Set(ids)]
  }

  function selectedIds(): string[] {
    if (!selectedId) return []
    const spot = spots.find((s) => s.id === selectedId)
    return spot ? spotMatchedOsmIds(spot) : []
  }

  function colorByOsmMatch(list: Spot[]): maplibregl.ExpressionSpecification {
    const expr: unknown[] = ['match', ['get', 'osmId']]
    let n = 0
    for (const s of list) {
      const level = (s.restriction?.level ?? 'check_local') as RestrictionLevel
      const color = RESTRICTION_COLORS[level]
      for (const id of spotMatchedOsmIds(s)) {
        expr.push(id, color)
        n++
      }
    }
    if (!n) return ['literal', '#7a9eae']
    expr.push('#7a9eae')
    return expr as maplibregl.ExpressionSpecification
  }

  function idFilter(
    geom: maplibregl.FilterSpecification,
    ids: string[],
  ): maplibregl.FilterSpecification {
    if (!ids.length) return ['all', geom, ['==', ['get', 'osmId'], '__none__']]
    return ['all', geom, ['in', ['get', 'osmId'], ['literal', ids]]]
  }

  function syncLayers() {
    if (!map || !ready) return
    const sIds = standingIds(spots)
    const rIds = riverIds(spots)
    const color = colorByOsmMatch(spots)
    const sel = selectedIds()
    const hover = hoverOsmId && osmToSpot(spots).has(hoverOsmId) ? [hoverOsmId] : []
    const hot = [...new Set([...sel, ...hover])]

    map.setFilter('water-fill', idFilter(POLY, sIds))
    map.setFilter('water-outline', idFilter(POLY, sIds))
    map.setFilter('water-line-bound', idFilter(LINE, rIds))
    map.setPaintProperty('water-fill', 'fill-color', color)
    map.setPaintProperty('water-outline', 'line-color', color)
    map.setPaintProperty('water-line-bound', 'line-color', color)

    // highlight via dedicated layers (avoids promoteId + feature-state / slash ids)
    map.setFilter('water-fill-hot', idFilter(POLY, hot.length ? hot.filter((id) => sIds.includes(id)) : []))
    map.setFilter('water-outline-hot', idFilter(POLY, hot.length ? hot.filter((id) => sIds.includes(id)) : []))
    map.setFilter(
      'water-line-hot',
      idFilter(LINE, hot.length ? hot.filter((id) => rIds.includes(id)) : []),
    )
  }

  function flyToSelection() {
    if (!map || !ready || !selectedId) return
    const spot = spots.find((s) => s.id === selectedId)
    if (!spot) return

    const ids = spotMatchedOsmIds(spot)
    if (ids.length && map.isSourceLoaded('water')) {
      const feats = map.querySourceFeatures('water', {
        sourceLayer: 'water',
        filter: ['in', ['get', 'osmId'], ['literal', ids]],
      })
      if (feats.length) {
        const b = new maplibregl.LngLatBounds()
        for (const f of feats) {
          const g = f.geometry
          if (!g) continue
          if (g.type === 'Polygon') {
            for (const ring of g.coordinates) for (const c of ring) b.extend(c as [number, number])
          } else if (g.type === 'MultiPolygon') {
            for (const poly of g.coordinates)
              for (const ring of poly) for (const c of ring) b.extend(c as [number, number])
          } else if (g.type === 'LineString') {
            for (const c of g.coordinates) b.extend(c as [number, number])
          } else if (g.type === 'MultiLineString') {
            for (const line of g.coordinates) for (const c of line) b.extend(c as [number, number])
          }
        }
        if (!b.isEmpty()) {
          map.fitBounds(b, { padding: 72, maxZoom: 13, duration: 650 })
          return
        }
      }
    }
    map.easeTo({ center: [spot.lng, spot.lat], zoom: Math.max(map.getZoom(), 11), duration: 600 })
  }

  $effect(() => {
    spots
    if (ready) syncLayers()
  })

  $effect(() => {
    selectedId
    if (ready) {
      syncLayers()
      flyToSelection()
    }
  })

  onMount(() => {
    // CRITICAL: metadata:true so TileJSON includes vector_layers (source-layer: water)
    protocol = new Protocol({ metadata: true })
    maplibregl.addProtocol('pmtiles', protocol.tile)
    const pmtilesUrl = `pmtiles://${absoluteDataUrl('water.pmtiles')}`

    map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO',
          },
          water: {
            type: 'vector',
            url: pmtilesUrl,
            attribution: 'Water: OpenStreetMap',
          },
        },
        layers: [
          { id: 'carto', type: 'raster', source: 'carto' },
          {
            id: 'water-line-context',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: LINE,
            paint: {
              'line-color': '#9db0bb',
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.35, 13, 1],
              'line-opacity': 0.35,
            },
          },
          {
            id: 'water-fill',
            type: 'fill',
            source: 'water',
            'source-layer': 'water',
            filter: idFilter(POLY, standingIds(spots)),
            paint: {
              'fill-color': colorByOsmMatch(spots),
              'fill-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.22, 10, 0.4, 13, 0.52],
            },
          },
          {
            id: 'water-outline',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: idFilter(POLY, standingIds(spots)),
            paint: {
              'line-color': colorByOsmMatch(spots),
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 13, 1.6],
              'line-opacity': 0.95,
            },
          },
          {
            id: 'water-line-bound',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: idFilter(LINE, riverIds(spots)),
            paint: {
              'line-color': colorByOsmMatch(spots),
              'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 12, 2.6, 14, 3.4],
              'line-opacity': 0.7,
            },
          },
          {
            id: 'water-fill-hot',
            type: 'fill',
            source: 'water',
            'source-layer': 'water',
            filter: idFilter(POLY, []),
            paint: {
              'fill-color': '#0b6e4f',
              'fill-opacity': 0.35,
            },
          },
          {
            id: 'water-outline-hot',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: idFilter(POLY, []),
            paint: {
              'line-color': '#064832',
              'line-width': 3.2,
              'line-opacity': 1,
            },
          },
          {
            id: 'water-line-hot',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: idFilter(LINE, []),
            paint: {
              'line-color': '#064832',
              'line-width': 5,
              'line-opacity': 0.95,
            },
          },
        ],
      },
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      maxBounds: [
        [MAP_EXTENT.west - 0.4, MAP_EXTENT.south - 0.3],
        [MAP_EXTENT.east + 0.4, MAP_EXTENT.north + 0.3],
      ],
      attributionControl: { compact: true },
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('error', (e) => {
      console.error(e)
      const msg = e.error?.message || String(e.error || '')
      // Only surface water/pmtiles failures — ignore transient raster blips
      if (/water|pmtiles|source layer/i.test(msg) && !mapError) {
        mapError = `Помилка шару карти: ${msg}`
      }
    })

    map.on('load', () => {
      if (!map) return
      mapError = null

      for (const layer of INTERACTIVE) {
        map.on('mouseenter', layer, () => {
          if (map) map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layer, () => {
          if (map) map.getCanvas().style.cursor = ''
          if (hoverOsmId) {
            hoverOsmId = null
            syncLayers()
          }
        })
        map.on('mousemove', layer, (e) => {
          const osmId = e.features?.[0]?.properties?.osmId
          if (typeof osmId !== 'string' || osmId === hoverOsmId) return
          hoverOsmId = osmId
          syncLayers()
        })
      }

      map.on('click', (e) => {
        const hits = map!.queryRenderedFeatures(e.point, { layers: [...INTERACTIVE] })
        if (!hits.length) {
          onSelect(null)
          return
        }
        const osmId = hits[0]?.properties?.osmId
        if (typeof osmId !== 'string') return
        const spot = osmToSpot(spots).get(osmId)
        if (spot) onSelect(spot.id)
      })

      ready = true
      syncLayers()
      if (selectedId) flyToSelection()
    })

    return () => {
      map?.remove()
      map = null
      if (protocol) {
        maplibregl.removeProtocol('pmtiles')
        protocol = null
      }
    }
  })

  onDestroy(() => {
    map?.remove()
    map = null
  })
</script>

<div class="map-root" bind:this={container} role="presentation"></div>
{#if mapError}
  <div class="map-error">{mapError}</div>
{/if}

<style>
  .map-root {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .map-error {
    position: absolute;
    left: 50%;
    bottom: 1.25rem;
    transform: translateX(-50%);
    z-index: 5;
    padding: 0.5rem 0.85rem;
    border-radius: 10px;
    background: rgba(122, 31, 22, 0.92);
    color: #fff;
    font-size: 0.85rem;
    max-width: min(90vw, 28rem);
  }
</style>
