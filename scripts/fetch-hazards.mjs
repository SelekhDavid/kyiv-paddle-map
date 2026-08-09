/**
 * Fetch river hazards (dams, weirs, locks, culverts, drains…) from Overpass,
 * snap each to nearest river LineString in water-shapes.geojson.
 *
 * Output: public/data/river-hazards.json
 * Run: npm run fetch-hazards
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'public', 'data')
const OUT = join(DATA, 'river-hazards.json')
const SHAPES = join(DATA, 'water-shapes.geojson')

/** Match operational map extent (see src/lib/mapExtent.ts) */
const BBOX = '49.85,29.20,51.28,32.30'
const SNAP_KM = 0.35

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

async function queryOverpass(query, label) {
  let lastErr = null
  for (const url of ENDPOINTS) {
    console.log(`[${label}] ${url}`)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': 'kyiv-paddle-map/1.1 (hazards fetch)',
        },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 180)}`)
        continue
      }
      return await res.json()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error('Overpass failed')
}

const HAZARD_QUERY = `
[out:json][timeout:180];
(
  node["waterway"="dam"](${BBOX});
  way["waterway"="dam"](${BBOX});
  node["waterway"="weir"](${BBOX});
  way["waterway"="weir"](${BBOX});
  node["waterway"="waterfall"](${BBOX});
  way["waterway"="waterfall"](${BBOX});
  node["waterway"="lock_gate"](${BBOX});
  way["waterway"="lock_gate"](${BBOX});
  node["waterway"="sluice_gate"](${BBOX});
  way["waterway"="sluice_gate"](${BBOX});
  node["waterway"="rapids"](${BBOX});
  way["waterway"="rapids"](${BBOX});
  node["waterway"="culvert"](${BBOX});
  way["waterway"="culvert"](${BBOX});
  node["tunnel"="culvert"](${BBOX});
  way["tunnel"="culvert"](${BBOX});
  way["waterway"="drain"](${BBOX});
  way["waterway"="ditch"](${BBOX});
  node["man_made"="wastewater_plant"](${BBOX});
  node["man_made"="pumping_station"]["pumping_station"="wastewater"](${BBOX});
);
out center tags;
`

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function classifyHazard(tags) {
  const ww = tags.waterway || ''
  const tunnel = tags.tunnel || ''
  const man = tags.man_made || ''
  if (ww === 'dam') return 'dam'
  if (ww === 'weir') return 'weir'
  if (ww === 'waterfall') return 'waterfall'
  if (ww === 'lock_gate') return 'lock'
  if (ww === 'sluice_gate') return 'sluice'
  if (ww === 'rapids') return 'rapids'
  if (ww === 'culvert' || tunnel === 'culvert') return 'culvert'
  if (ww === 'drain') return 'drain'
  if (ww === 'ditch') return 'ditch'
  if (man === 'wastewater_plant' || tags.pumping_station === 'wastewater') return 'wastewater'
  return 'other'
}

const KIND_UK = {
  dam: 'Дамба',
  weir: 'Гребля / перелив',
  waterfall: 'Водоспад',
  lock: 'Шлюз',
  sluice: 'Затвор / шлюзний отвір',
  rapids: 'Перекати / пороги',
  culvert: 'Колектор / водопропуск',
  drain: 'Дренажний канал',
  ditch: 'Канава / рів',
  wastewater: 'Очисні / насосна (стоки)',
  other: 'Перешкода на воді',
}

function pointFromElement(el) {
  if (el.type === 'node' && el.lat != null && el.lon != null) {
    return { lat: el.lat, lng: el.lon }
  }
  if (el.center?.lat != null && el.center?.lon != null) {
    return { lat: el.center.lat, lng: el.center.lon }
  }
  return null
}

function minDistToLineKm(lat, lng, coords) {
  let best = Infinity
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i]
    const [lng2, lat2] = coords[i + 1]
    // Sample midpoint + endpoints (fast enough for snap)
    const samples = [
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 },
      { lat: (lat1 + lat2) / 2, lng: (lng1 + lng2) / 2 },
    ]
    for (const s of samples) {
      const d = haversineKm({ lat, lng }, s)
      if (d < best) best = d
    }
  }
  return best
}

function snapToRiver(lat, lng, rivers) {
  let best = null
  for (const r of rivers) {
    // Quick reject by representative center
    if (haversineKm({ lat, lng }, { lat: r.lat, lng: r.lng }) > SNAP_KM + 8) continue
    const d = minDistToLineKm(lat, lng, r.coords)
    if (d <= SNAP_KM && (!best || d < best.distKm)) {
      best = { osmId: r.osmId, name: r.name, distKm: d }
    }
  }
  return best
}

async function main() {
  const shapes = JSON.parse(await readFile(SHAPES, 'utf8'))
  const rivers = []
  for (const f of shapes.features || []) {
    if (f.geometry?.type !== 'LineString' || f.properties?.kind !== 'river') continue
    const coords = f.geometry.coordinates
    if (!coords?.length) continue
    rivers.push({
      osmId: f.properties.osmId,
      name: f.properties.nameUk || f.properties.name || null,
      lat: f.properties.lat,
      lng: f.properties.lng,
      coords,
    })
  }
  console.log(`River lines for snap: ${rivers.length}`)

  const raw = await queryOverpass(HAZARD_QUERY, 'hazards')
  const features = []
  const seen = new Set()
  const kindCounts = {}

  for (const el of raw.elements || []) {
    const tags = el.tags || {}
    const pt = pointFromElement(el)
    if (!pt) continue
    const kind = classifyHazard(tags)
    const osmId = `${el.type}/${el.id}`
    if (seen.has(osmId)) continue
    seen.add(osmId)

    const host = snapToRiver(pt.lat, pt.lng, rivers)
    if (!host) continue // only keep hazards on mapped rivers

    kindCounts[kind] = (kindCounts[kind] || 0) + 1
    features.push({
      id: osmId,
      kind,
      labelUk: KIND_UK[kind] || KIND_UK.other,
      name: tags['name:uk'] || tags.name || null,
      lat: pt.lat,
      lng: pt.lng,
      hostRiverOsmId: host.osmId,
      hostRiverName: host.name,
      snapKm: Math.round(host.distKm * 1000) / 1000,
      source: 'OpenStreetMap',
    })
  }

  const doc = {
    generatedAt: new Date().toISOString(),
    method: 'overpass+snap-to-river-lines',
    snapKmMax: SNAP_KM,
    bbox: BBOX,
    counts: { total: features.length, byKind: kindCounts },
    features,
  }

  await mkdir(DATA, { recursive: true })
  await writeFile(OUT, JSON.stringify(doc), 'utf8')
  console.log(`Wrote ${features.length} hazards → ${OUT}`)
  console.log('byKind:', kindCounts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
