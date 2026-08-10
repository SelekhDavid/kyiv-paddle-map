/**
 * Build public/data/water.pmtiles
 *
 * Preferred: tippecanoe (Linux CI / WSL / Docker / macOS)
 * Fallback: geojson-vt + vt-pbf + Python pmtiles writer (Windows local)
 *
 * Usage:
 *   node scripts/build-water-pmtiles.mjs
 *   TIPPECANOE_BIN=tippecanoe node scripts/build-water-pmtiles.mjs
 *   FORCE_LEGACY=1 node scripts/build-water-pmtiles.mjs
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const cacheGeo = join(root, 'public/data/.cache/water-for-tiles.geojson')
const outPmtiles = join(root, 'public/data/water.pmtiles')
const packer = join(__dirname, '_pack_pmtiles.py')
const forceLegacy = process.env.FORCE_LEGACY === '1'
const ci = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: false, ...opts })
  return r.status ?? 1
}

function which(bin) {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], {
    encoding: 'utf8',
  })
  if (r.status !== 0) return null
  const line = (r.stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0]
  return line || null
}

function dockerTippecanoe(geojsonAbs, outAbs) {
  const docker = which('docker')
  if (!docker) return false
  const dataDir = join(root, 'public/data')
  // Use a well-known image if present; otherwise skip (CI installs tippecanoe natively)
  const image = process.env.TIPPECANOE_IMAGE || ''
  if (!image) return false
  console.log('Running tippecanoe via Docker', image)
  const code = run('docker', [
    'run',
    '--rm',
    '-v',
    `${dataDir}:/data`,
    image,
    'tippecanoe',
    ...tippecanoeArgs('/data/.cache/water-for-tiles.geojson', '/data/water.pmtiles'),
  ])
  return code === 0 && existsSync(outAbs)
}

function tippecanoeArgs(input, output) {
  return [
    '--force',
    '--output',
    output,
    '--layer',
    'water',
    '--name',
    'kyiv-paddle-water',
    '--attribution',
    '© OpenStreetMap',
    '--minimum-zoom=6',
    '--maximum-zoom=13',
    '--full-detail=13',
    '--low-detail=9',
    '--minimum-detail=7',
    // Larger buffer → fewer fill gaps across tile edges
    '--buffer=64',
    '--simplification=8',
    '--detect-shared-borders',
    '--coalesce-densest-as-needed',
    '--extend-zooms-if-still-dropping',
    '--no-tile-size-limit',
    '--no-feature-limit',
    input,
  ]
}

function buildWithTippecanoe(bin, input, output) {
  console.log('tippecanoe →', output)
  const code = run(bin, tippecanoeArgs(input, output))
  return code === 0
}

async function buildLegacy(input, output) {
  console.log('Legacy geojson-vt path (no tippecanoe on PATH)')
  const geojsonvt = (await import('geojson-vt')).default
  const vtpbf = (await import('vt-pbf')).default

  const MAP_EXTENT = { south: 49.85, west: 29.2, north: 51.28, east: 32.3 }
  const MIN_Z = 6
  const MAX_Z = 12
  const lon2tile = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z)
  const lat2tile = (lat, z) => {
    const r = (lat * Math.PI) / 180
    return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
  }

  const gj = JSON.parse(readFileSync(input, 'utf8'))
  const index = geojsonvt(gj, {
    maxZoom: MAX_Z,
    indexMaxZoom: MAX_Z,
    indexMaxPoints: 0,
    tolerance: 2,
    extent: 4096,
    buffer: 128,
  })

  const tileDir = join(root, '.tmp-water-tiles')
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
        if (!tile?.features?.length) continue
        const buf = vtpbf.fromGeojsonVt({ water: tile })
        const dir = join(tileDir, String(z), String(x))
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, `${y}.mvt`), Buffer.from(buf))
        written++
      }
    }
    console.log(`z${z}: tiles so far ${written}`)
  }

  const py = spawnSync('python', [packer, tileDir, output], { stdio: 'inherit', cwd: root })
  rmSync(tileDir, { recursive: true, force: true })
  if (py.status !== 0) process.exit(py.status ?? 1)
}

// 1) prepare slim geojson
if (run(process.execPath, [join(__dirname, 'prepare-water-for-tiles.mjs')]) !== 0) {
  process.exit(1)
}
if (!existsSync(cacheGeo)) {
  console.error('Missing prepared geojson', cacheGeo)
  process.exit(1)
}

const tippecanoeBin = process.env.TIPPECANOE_BIN || which('tippecanoe')

let ok = false
if (!forceLegacy && tippecanoeBin) {
  ok = buildWithTippecanoe(tippecanoeBin, cacheGeo, outPmtiles)
} else if (!forceLegacy && dockerTippecanoe(cacheGeo, outPmtiles)) {
  ok = true
} else if (ci && !forceLegacy) {
  console.error('CI requires tippecanoe on PATH (install in workflow before this script)')
  process.exit(1)
} else {
  await buildLegacy(cacheGeo, outPmtiles)
  ok = existsSync(outPmtiles)
}

if (!ok || !existsSync(outPmtiles)) {
  console.error('Failed to write', outPmtiles)
  process.exit(1)
}

const size = readFileSync(outPmtiles).byteLength
console.log(`Wrote ${outPmtiles} (${(size / (1024 * 1024)).toFixed(2)} MB)`)
