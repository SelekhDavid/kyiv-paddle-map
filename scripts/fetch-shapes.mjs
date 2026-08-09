/**
 * Fetch water polygons + river linestrings with full geometry from Overpass.
 * Output: public/data/water-shapes.geojson
 *
 * Run: npm run fetch-shapes
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'data', 'water-shapes.geojson')

// Kyiv oblast + buffer; north cut omits Belarus border belt / deep Chernihiv
const BBOX = '49.85,29.20,51.28,32.30'

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
          'User-Agent': 'kyiv-paddle-map/1.1 (geometry fetch)',
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

const WATER_QUERY = `
[out:json][timeout:180];
(
  way["natural"="water"]["name"](${BBOX});
  relation["natural"="water"]["name"](${BBOX});
  way["water"~"^(lake|reservoir|pond|basin|oxbow)$"]["name"](${BBOX});
  relation["water"~"^(lake|reservoir|pond|basin|oxbow)$"]["name"](${BBOX});
  way["landuse"="quarry"](${BBOX});
  way["water"="basin"](${BBOX});
  way["natural"="water"]["water"="pond"](${BBOX});
);
out body;
>;
out skel qt;
`

const RIVER_QUERY = `
[out:json][timeout:180];
(
  way["waterway"="river"](${BBOX});
  way["waterway"="canal"]["name"](${BBOX});
  way["waterway"="stream"]["name"~"Ірпін|Ирпен|Десн|Стугн|Здвиж|Остер|Трубіж|Рось|Тетер|Красн|Унав|Горенк|Любк|Віт",i](${BBOX});
  relation["waterway"="river"](${BBOX});
);
out body;
>;
out skel qt;
`

/** Build node id → {lat,lon} map */
function indexNodes(elements) {
  const nodes = new Map()
  for (const el of elements) {
    if (el.type === 'node') nodes.set(el.id, [el.lon, el.lat])
  }
  return nodes
}

function wayCoords(way, nodes) {
  const coords = []
  for (const id of way.nodes || []) {
    const c = nodes.get(id)
    if (c) coords.push(c)
  }
  return coords
}

function isClosed(coords) {
  if (coords.length < 4) return false
  const a = coords[0]
  const b = coords[coords.length - 1]
  return a[0] === b[0] && a[1] === b[1]
}

function centroid(coords) {
  let x = 0
  let y = 0
  const n = coords.length - (isClosed(coords) ? 1 : 0)
  const slice = coords.slice(0, n)
  for (const [lon, lat] of slice) {
    x += lon
    y += lat
  }
  return [x / slice.length, y / slice.length]
}

function classify(tags, geomType) {
  if (tags.waterway === 'river' || tags.waterway === 'canal' || tags.waterway === 'stream' || geomType === 'LineString')
    return 'river'
  if (tags.landuse === 'quarry') return 'quarry'
  if (tags.water === 'basin') return 'basin'
  if (tags.water === 'pond' || tags.water === 'oxbow') return 'pond'
  if (tags.water === 'reservoir') return 'reservoir'
  if (tags.water === 'lake' || tags.natural === 'water') return 'lake'
  return tags.water || tags.natural || 'water'
}

/** Heuristic flow along Dnipro corridor: north→south through Kyiv oblast */
function inferFlow(name, coords) {
  if (!coords || coords.length < 2) return null
  const n = (name || '').toLowerCase()
  const first = coords[0]
  const last = coords[coords.length - 1]
  // Prefer known hydrology: Dnipro / Desna generally N→S / NW→SE into mouth
  if (/дніпр|днепр|десн/.test(n)) {
    // ensure vector goes southward overall
    if (first[1] < last[1]) return [...coords].reverse()
    return coords
  }
  if (/рось/.test(n)) {
    // Ros flows roughly W→E then to Dnipro
    if (first[0] > last[0]) return [...coords].reverse()
    return coords
  }
  if (/ірпін|ирпен/.test(n)) {
    // Irpin flows south to Dnipro
    if (first[1] < last[1]) return [...coords].reverse()
    return coords
  }
  // default: keep OSM order, mark as assumed_downstream
  return coords
}

function wayToFeatures(way, nodes) {
  const tags = way.tags || {}
  let coords = wayCoords(way, nodes)
  if (coords.length < 2) return []

  const name = tags.name || tags['name:uk'] || tags['name:en'] || null
  const kind = classify(tags, isClosed(coords) ? 'Polygon' : 'LineString')

  if (kind === 'river' || tags.waterway === 'river' || tags.waterway === 'canal' || tags.waterway === 'stream') {
    coords = inferFlow(name, coords)
    const [lng, lat] = centroid(coords)
    return [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          osmId: `way/${way.id}`,
          name: name || (tags.waterway === 'canal' ? 'Канал' : 'Річка'),
          nameUk: tags['name:uk'] || tags.name || null,
          nameEn: tags['name:en'] || null,
          kind: 'river',
          water: tags.waterway || 'river',
          flow: 'downstream_indicated',
          lat,
          lng,
          source: 'OpenStreetMap',
        },
      },
    ]
  }

  // Quarries sometimes not closed; treat open as skip or force open line skip
  if (!isClosed(coords)) {
    // try close small gaps
    const a = coords[0]
    const b = coords[coords.length - 1]
    const dist = Math.hypot(a[0] - b[0], a[1] - b[1])
    if (dist < 0.002 && coords.length >= 3) {
      coords = [...coords, coords[0]]
    } else {
      return []
    }
  }

  // skip tiny polygons
  if (coords.length < 4) return []

  const [lng, lat] = centroid(coords)
  return [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {
        osmId: `way/${way.id}`,
        name: name || (kind === 'quarry' ? 'Карʼєр (без назви)' : 'Водойма'),
        nameUk: tags['name:uk'] || tags.name || (kind === 'quarry' ? 'Карʼєр' : null),
        nameEn: tags['name:en'] || null,
        kind,
        water: tags.water || tags.landuse || tags.natural || kind,
        lat,
        lng,
        source: 'OpenStreetMap',
      },
    },
  ]
}

function samePoint(a, b, eps = 1e-7) {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps
}

/** Join open way segments into closed rings (OSM multipolygon outers/inners). */
function assembleRings(segments) {
  const unused = segments
    .map((c) => c.slice())
    .filter((c) => c.length >= 2)
  const rings = []

  while (unused.length) {
    let ring = unused.shift()
    if (isClosed(ring) && ring.length >= 4) {
      rings.push(ring)
      continue
    }

    let guard = unused.length + 5
    while (!isClosed(ring) && unused.length && guard-- > 0) {
      const end = ring[ring.length - 1]
      const start = ring[0]
      let idx = unused.findIndex((s) => samePoint(s[0], end) || samePoint(s[s.length - 1], end))
      if (idx >= 0) {
        const s = unused.splice(idx, 1)[0]
        const add = samePoint(s[0], end) ? s.slice(1) : s.slice(0, -1).reverse()
        ring = ring.concat(add)
        continue
      }
      idx = unused.findIndex((s) => samePoint(s[0], start) || samePoint(s[s.length - 1], start))
      if (idx >= 0) {
        const s = unused.splice(idx, 1)[0]
        const add = samePoint(s[s.length - 1], start) ? s.slice(0, -1) : s.slice(1).reverse()
        ring = add.concat(ring)
        continue
      }
      break
    }

    if (!isClosed(ring) && ring.length >= 3) {
      ring = [...ring, ring[0]]
    }
    if (isClosed(ring) && ring.length >= 4) rings.push(ring)
  }
  return rings
}

function relationToFeatures(rel, waysById, nodes) {
  const tags = rel.tags || {}
  const outerSegs = []
  const innerSegs = []

  for (const m of rel.members || []) {
    if (m.type !== 'way') continue
    const way = waysById.get(m.ref)
    if (!way) continue
    const coords = wayCoords(way, nodes)
    if (coords.length < 2) continue
    const role = m.role || 'outer'
    if (role === 'inner') innerSegs.push(coords)
    else if (role === 'outer' || role === '') outerSegs.push(coords)
  }

  const outers = assembleRings(outerSegs)
  if (!outers.length) return []
  const inners = assembleRings(innerSegs)

  // Attach each inner to the first outer (good enough for reservoirs); better than 93 stubs
  const polygons = outers.map((outer, i) => {
    const holes = i === 0 ? inners : []
    return [outer, ...holes]
  })

  const name = tags.name || tags['name:uk'] || tags['name:en'] || 'Водойма'
  const kind = classify(tags, 'Polygon')
  const [lng, lat] = centroid(outers[0])

  return [
    {
      type: 'Feature',
      geometry:
        polygons.length === 1
          ? { type: 'Polygon', coordinates: polygons[0] }
          : { type: 'MultiPolygon', coordinates: polygons },
      properties: {
        osmId: `relation/${rel.id}`,
        name,
        nameUk: tags['name:uk'] || tags.name || null,
        nameEn: tags['name:en'] || null,
        kind: kind === 'river' ? 'lake' : kind,
        water: tags.water || tags.natural || kind,
        lat,
        lng,
        source: 'OpenStreetMap',
        ringCount: outers.length,
      },
    },
  ]
}

function elementsToFeatures(elements) {
  const nodes = indexNodes(elements)
  const waysById = new Map()
  const features = []

  for (const el of elements) {
    if (el.type === 'way' && el.nodes) waysById.set(el.id, el)
  }

  for (const el of elements) {
    if (el.type === 'way' && el.tags) {
      features.push(...wayToFeatures(el, nodes))
    }
  }
  for (const el of elements) {
    if (el.type === 'relation' && el.tags) {
      features.push(...relationToFeatures(el, waysById, nodes))
    }
  }
  return features
}

function dedupe(features) {
  const seen = new Set()
  return features.filter((f) => {
    const id = f.properties.osmId
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

async function main() {
  console.log('Fetching water polygons / quarries…')
  const water = await queryOverpass(WATER_QUERY, 'water')
  console.log('Fetching rivers…')
  const rivers = await queryOverpass(RIVER_QUERY, 'rivers')

  const features = dedupe([
    ...elementsToFeatures(water.elements || []),
    ...elementsToFeatures(rivers.elements || []),
  ])

  const geojson = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    bbox: BBOX,
    features,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(geojson), 'utf8')
  const kinds = {}
  for (const f of features) {
    kinds[f.properties.kind] = (kinds[f.properties.kind] || 0) + 1
  }
  console.log(`Wrote ${features.length} shapes → ${OUT}`)
  console.log('Kinds:', kinds)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
