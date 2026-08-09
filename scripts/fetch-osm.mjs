/**
 * Fetch named lakes/reservoirs/rivers from OSM Overpass for Kyiv oblast + adjacent belts.
 * Run: npm run fetch-osm
 *
 * Output: public/data/osm-water.geojson
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'data', 'osm-water.geojson')

// Kyiv oblast + thin buffer (approx)
const BBOX = '49.85,29.20,51.55,32.30'

const QUERY = `
[out:json][timeout:120];
(
  way["natural"="water"]["name"](${BBOX});
  relation["natural"="water"]["name"](${BBOX});
  way["water"="lake"]["name"](${BBOX});
  way["water"="reservoir"]["name"](${BBOX});
  relation["water"="lake"]["name"](${BBOX});
  relation["water"="reservoir"]["name"](${BBOX});
  way["waterway"="riverbank"]["name"](${BBOX});
  relation["waterway"="riverbank"]["name"](${BBOX});
);
out center tags;
`

function elementToFeature(el) {
  const lat = el.center?.lat ?? el.lat
  const lon = el.center?.lon ?? el.lon
  if (lat == null || lon == null) return null

  const tags = el.tags || {}
  const waterType =
    tags.water ||
    (tags.natural === 'water' ? 'water' : null) ||
    tags.waterway ||
    'unknown'

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      osmId: `${el.type}/${el.id}`,
      name: tags.name || tags['name:uk'] || tags['name:en'] || 'без назви',
      nameUk: tags['name:uk'] || tags.name || null,
      nameEn: tags['name:en'] || null,
      water: waterType,
      leisure: tags.leisure || null,
      access: tags.access || null,
      source: 'OpenStreetMap',
    },
  }
}

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

async function queryOverpass(query) {
  let lastErr = null
  for (const url of ENDPOINTS) {
    console.log(`Trying ${url}…`)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': 'kyiv-paddle-map/1.0 (local research; contact: local-dev)',
        },
        body: `data=${encodeURIComponent(query)}`,
      })
      if (!res.ok) {
        lastErr = new Error(`Overpass HTTP ${res.status} @ ${url}: ${(await res.text()).slice(0, 200)}`)
        continue
      }
      return await res.json()
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr ?? new Error('All Overpass endpoints failed')
}

async function main() {
  console.log('Querying Overpass…')
  const data = await queryOverpass(QUERY)
  const features = (data.elements || [])
    .map(elementToFeature)
    .filter(Boolean)

  // Deduplicate by osmId
  const seen = new Set()
  const unique = features.filter((f) => {
    const id = f.properties.osmId
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  const geojson = {
    type: 'FeatureCollection',
    generatedAt: new Date().toISOString(),
    bbox: BBOX,
    features: unique,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(geojson, null, 2), 'utf8')
  console.log(`Wrote ${unique.length} features → ${OUT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
