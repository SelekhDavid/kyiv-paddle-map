<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import { Protocol } from 'pmtiles'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import type { Spot } from '../lib/types'
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

  const POLY_FILTER: maplibregl.FilterSpecification = [
    'any',
    ['==', ['geometry-type'], 'Polygon'],
    ['==', ['geometry-type'], 'MultiPolygon'],
  ]

  const LINE_FILTER: maplibregl.FilterSpecification = [
    'any',
    ['==', ['geometry-type'], 'LineString'],
    ['==', ['geometry-type'], 'MultiLineString'],
  ]

  function standingOsmIds(list: Spot[]): string[] {
    const ids = new Set<string>()
    for (const s of list) {
      if (!isStandingWaterKind(s.kind)) continue
      for (const id of spotMatchedOsmIds(s)) ids.add(id)
    }
    return [...ids]
  }

  function boundFillFilter(list: Spot[]): maplibregl.FilterSpecification {
    const ids = standingOsmIds(list)
    if (!ids.length) {
      return ['all', POLY_FILTER, ['==', ['get', 'osmId'], '__none__']]
    }
    return ['all', POLY_FILTER, ['in', ['get', 'osmId'], ['literal', ids]]]
  }

  function spotsGeoJson(list: Spot[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: list.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id,
          nameUk: s.nameUk,
          level: s.restriction?.level ?? 'check_local',
          color: RESTRICTION_COLORS[s.restriction?.level ?? 'check_local'],
        },
      })),
    }
  }

  function syncSpots() {
    if (!map || !ready) return
    const src = map.getSource('spots') as maplibregl.GeoJSONSource | undefined
    src?.setData(spotsGeoJson(spots))
    if (map.getLayer('water-fill-bound')) {
      map.setFilter('water-fill-bound', boundFillFilter(spots))
    }
    if (map.getLayer('water-outline-bound')) {
      map.setFilter('water-outline-bound', boundFillFilter(spots))
    }
  }

  function syncSelection() {
    if (!map || !ready) return
    if (map.getLayer('spots-circle')) {
      map.setPaintProperty('spots-circle', 'circle-stroke-width', [
        'case',
        ['==', ['get', 'id'], selectedId ?? ''],
        3,
        1,
      ])
      map.setPaintProperty('spots-circle', 'circle-radius', [
        'case',
        ['==', ['get', 'id'], selectedId ?? ''],
        9,
        6,
      ])
    }
    const spot = spots.find((s) => s.id === selectedId)
    if (!spot) return

    // Highlight selected standing polys stronger
    const ids = isStandingWaterKind(spot.kind) ? spotMatchedOsmIds(spot) : []
    if (map.getLayer('water-fill-selected')) {
      map.setFilter(
        'water-fill-selected',
        ids.length
          ? ['all', POLY_FILTER, ['in', ['get', 'osmId'], ['literal', ids]]]
          : ['==', ['get', 'osmId'], '__none__'],
      )
    }

    map.easeTo({ center: [spot.lng, spot.lat], zoom: Math.max(map.getZoom(), 11), duration: 600 })
  }

  $effect(() => {
    spots
    syncSpots()
  })

  $effect(() => {
    selectedId
    syncSelection()
  })

  onMount(() => {
    protocol = new Protocol()
    maplibregl.addProtocol('pmtiles', protocol.tile)

    const pmtilesUrl = `pmtiles://${absoluteDataUrl('water.pmtiles')}`

    map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          // Positron: quieter water fill than Carto light_all → less dual-water clash
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
          // A4: product fill ONLY for standing spots with OSM bind (not full OSM mesh)
          {
            id: 'water-fill-bound',
            type: 'fill',
            source: 'water',
            'source-layer': 'water',
            filter: boundFillFilter(spots),
            paint: {
              'fill-color': '#5a9fc4',
              'fill-opacity': 0.38,
            },
          },
          {
            id: 'water-outline-bound',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: boundFillFilter(spots),
            paint: {
              'line-color': '#2f6f94',
              'line-width': 1.2,
              'line-opacity': 0.9,
            },
          },
          {
            id: 'water-fill-selected',
            type: 'fill',
            source: 'water',
            'source-layer': 'water',
            filter: ['==', ['get', 'osmId'], '__none__'],
            paint: {
              'fill-color': '#0b6e4f',
              'fill-opacity': 0.28,
            },
          },
          // Rivers: thin network context (axes), not area fills
          {
            id: 'water-line',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: LINE_FILTER,
            paint: {
              'line-color': '#6a8fa3',
              'line-width': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8,
                0.6,
                12,
                1.8,
                14,
                2.4,
              ],
              'line-opacity': 0.55,
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
      if (!mapError) mapError = 'Помилка шару карти (перевірте water.pmtiles)'
    })

    map.on('load', () => {
      if (!map) return
      map.addSource('spots', {
        type: 'geojson',
        data: spotsGeoJson(spots),
      })
      map.addLayer({
        id: 'spots-circle',
        type: 'circle',
        source: 'spots',
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 6,
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
          'circle-opacity': 0.92,
        },
      })
      map.on('mouseenter', 'spots-circle', () => {
        if (map) map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'spots-circle', () => {
        if (map) map.getCanvas().style.cursor = ''
      })
      map.on('click', 'spots-circle', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (typeof id === 'string') onSelect(id)
      })
      ready = true
      syncSpots()
      syncSelection()
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
