<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import maplibregl from 'maplibre-gl'
  import { Protocol } from 'pmtiles'
  import 'maplibre-gl/dist/maplibre-gl.css'
  import type { Spot } from '../lib/types'
  import { absoluteDataUrl } from '../lib/dataUrl'
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
    if (spot) {
      map.easeTo({ center: [spot.lng, spot.lat], zoom: Math.max(map.getZoom(), 11), duration: 600 })
    }
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
          carto: {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
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
            id: 'water-fill',
            type: 'fill',
            source: 'water',
            'source-layer': 'water',
            filter: [
              'any',
              ['==', ['geometry-type'], 'Polygon'],
              ['==', ['geometry-type'], 'MultiPolygon'],
            ],
            paint: {
              'fill-color': '#7eb6d9',
              'fill-opacity': 0.45,
            },
          },
          {
            id: 'water-line',
            type: 'line',
            source: 'water',
            'source-layer': 'water',
            filter: [
              'any',
              ['==', ['geometry-type'], 'LineString'],
              ['==', ['geometry-type'], 'MultiLineString'],
            ],
            paint: {
              'line-color': '#3d7ea6',
              'line-width': 1.6,
              'line-opacity': 0.85,
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
