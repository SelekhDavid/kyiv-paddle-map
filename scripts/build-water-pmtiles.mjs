/**
 * Build public/data/water.pmtiles from water-shapes.geojson (Node tile cut + Python pack).
 * Usage: node scripts/build-water-pmtiles.mjs
 */
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import geojsonvt from 'geojson-vt'
import vtpbf from 'vt-pbf'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const input = join(root, 'public/data/water-shapes.geojson')
const tileDir = join(root, '.tmp-water-tiles')
const outPmtiles = join(root, 'public/data/water.pmtiles')
const packer = join(__dirname, '_pack_pmtiles.py')

const MAP_EXTENT = { south: 49.85, west: 29.2, north: 51.28, east: 32.3 }
const MIN_Z = 6
const MAX_Z = 12

function lon2tile(lon, z) {
  return Math.floor(((lon + 180) / 360) * 2 ** z)
}
function lat2tile(lat, z) {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

if (!existsSync(input)) {
  console.error('Missing', input, '— run npm run fetch-shapes first')
  process.exit(1)
}

console.log('Reading', input)
const gj = JSON.parse(readFileSync(input, 'utf8'))
console.log('Features:', gj.features?.length ?? 0)

const index = geojsonvt(gj, {
  maxZoom: MAX_Z,
  indexMaxZoom: MAX_Z,
  indexMaxPoints: 0,
  tolerance: 3,
  extent: 4096,
  buffer: 64,
  lineMetrics: false,
  promoteId: null,
})

if (existsSync(tileDir)) rmSync(tileDir, { recursive: true, force: true })
mkdirSync(tileDir, { recursive: true })

let written = 0
for (let z = MIN_Z; z <= MAX_Z; z++) {
  const x0 = lon2tile(MAP_EXTENT.west, z)
  const x1 = lon2tile(MAP_EXTENT.east, z)
  const y0 = lat2tile(MAP_EXTENT.north, z)
  const y1 = lat2tile(MAP_EXTENT.south, z)
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const tile = index.getTile(z, x, y)
      if (!tile || !tile.features?.length) continue
      const buf = vtpbf.fromGeojsonVt({ water: tile })
      const dir = join(tileDir, String(z), String(x))
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${y}.mvt`), Buffer.from(buf))
      written++
    }
  }
  console.log(`z${z}: tiles so far ${written}`)
}

console.log('Packing PMTiles…')
const py = spawnSync('python', [packer, tileDir, outPmtiles], { stdio: 'inherit', cwd: root })
if (py.status !== 0) {
  console.error('Pack failed')
  process.exit(py.status ?? 1)
}
rmSync(tileDir, { recursive: true, force: true })
console.log('Wrote', outPmtiles)
