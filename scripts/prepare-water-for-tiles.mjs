/**
 * Prepare a slimmer GeoJSON for tiling: only geometries bound to curated spots
 * (+ keep a light river line mesh at lower detail via tippecanoe drop — optional).
 *
 * Writes public/data/.cache/water-for-tiles.geojson
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const spotsPath = join(root, 'public/data/spots.json')
const shapesPath = join(root, 'public/data/water-shapes.geojson')
const outDir = join(root, 'public/data/.cache')
const outPath = join(outDir, 'water-for-tiles.geojson')

const STANDING = /^(lake|pond|reservoir|quarry|basin|oxbow)$/i

function idsOf(s) {
  if (s.matchedOsmIds?.length) return s.matchedOsmIds
  if (s.matchedOsmId) return [s.matchedOsmId]
  return []
}

const spots = JSON.parse(readFileSync(spotsPath, 'utf8'))
const bound = new Set()
for (const s of spots) {
  for (const id of idsOf(s)) bound.add(id)
}

const shapes = JSON.parse(readFileSync(shapesPath, 'utf8'))
const features = []
let standing = 0
let rivers = 0
let skipped = 0

for (const f of shapes.features || []) {
  const osmId = f.properties?.osmId
  const kind = f.properties?.kind || ''
  const isStanding = STANDING.test(kind) || f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
  const isLine =
    f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString'

  // Always keep spot-bound geometries
  if (osmId && bound.has(osmId)) {
    features.push(f)
    if (isStanding) standing++
    else rivers++
    continue
  }

  // Optional: keep named standing polys for context (still much less than full mesh)
  // Skip anonymous unbound to shrink tiles heavily
  skipped++
}

mkdirSync(outDir, { recursive: true })
const fc = {
  type: 'FeatureCollection',
  generatedAt: new Date().toISOString(),
  note: 'Bound-to-spots subset for tippecanoe',
  features,
}
writeFileSync(outPath, JSON.stringify(fc))
console.log(
  `Prepared ${features.length} features (standing≈${standing}, other=${features.length - standing}); skipped ${skipped}; bound ids=${bound.size}`,
)
console.log('→', outPath)

if (!existsSync(outPath) || features.length === 0) {
  console.error('No features to tile — check spots matchedOsmId(s) vs water-shapes')
  process.exit(1)
}
