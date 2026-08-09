/**
 * Method silo: OSM river-area polygons → orthogonal channel width.
 *
 * Algorithm (RivWidth-like, docs/methodology-river-width.md §A):
 * 1. Select Polygon/MultiPolygon with water ∈ {river, canal, stream} in MAP_EXTENT
 * 2. Project to local metres; densify bank; inward normals → opposite-bank midpoints
 * 3. Order midpoints into an approximate centerline; every CENTER_STEP_M cast a
 *    local orthogonal through the polygon → sample width
 * 4. Median / P10 with outlier cap; skip tiny scraps and blob-like parts (4A/P huge)
 *
 * Output: docs/research/river-width/osm-polygon.json
 *
 * Full run:
 *   node scripts/estimate-osm-polygon-widths.mjs
 *
 * Priority subset (Дніпро, Десна, Ірпінь, Тетерів, Рось):
 *   node scripts/estimate-osm-polygon-widths.mjs --priority
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SHAPES = join(ROOT, 'public', 'data', 'water-shapes.geojson')
const OUT_DIR = join(ROOT, 'docs', 'research', 'river-width')
const OUT = join(OUT_DIR, 'osm-polygon.json')

/** Match src/lib/mapExtent.ts */
const MAP_EXTENT = { south: 49.85, west: 29.2, north: 51.28, east: 32.3 }

const WATER_OK = new Set(['river', 'canal', 'stream'])
const BANK_STEP_M = 40
const DENSIFY_M = 15
const CENTER_STEP_M = 75
const MIN_PERIM_M = 120
const MIN_AREA_M2 = 800
const MIN_WIDTH_M = 2
const MAX_WIDTH_M = 2500
/** Skip floodplain-style blobs where mean hydraulic diameter is absurd */
const MAX_BLOB_WIDTH_M = 900
const MIN_SAMPLES = 3
const REVERSE_TOL_M = 30

const PRIORITY_NAME_RE =
  /дніпро|днепр|десна|ірпін|ирпен|тетерів|тетерев|рось/i

const priorityOnly = process.argv.includes('--priority')

function inMapExtent(lat, lng) {
  return (
    lat >= MAP_EXTENT.south &&
    lat <= MAP_EXTENT.north &&
    lng >= MAP_EXTENT.west &&
    lng <= MAP_EXTENT.east
  )
}

function percentile(sorted, p) {
  if (!sorted.length) return null
  if (sorted.length === 1) return sorted[0]
  const i = (sorted.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  if (lo === hi) return sorted[lo]
  return sorted[lo] * (hi - i) + sorted[hi] * (i - lo)
}

function ringAreaM2(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
  }
  return Math.abs(a) / 2
}

function ringPerimeterM(ring) {
  let p = 0
  for (let i = 0; i < ring.length - 1; i++) {
    p += Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1])
  }
  return p
}

function projectRing(ringLngLat, lon0, lat0) {
  const cos = Math.cos((lat0 * Math.PI) / 180)
  return ringLngLat.map(([lng, lat]) => [
    (lng - lon0) * 111_320 * cos,
    (lat - lat0) * 111_320,
  ])
}

function unproject(x, y, lon0, lat0) {
  const cos = Math.cos((lat0 * Math.PI) / 180)
  return {
    lng: lon0 + x / (111_320 * cos),
    lat: lat0 + y / 111_320,
  }
}

function ensureClosed(ring) {
  if (ring.length < 3) return ring
  const a = ring[0]
  const b = ring[ring.length - 1]
  if (a[0] === b[0] && a[1] === b[1]) return ring
  return [...ring, [a[0], a[1]]]
}

function densifyRing(ring, stepM) {
  const out = []
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]
    const b = ring[i + 1]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.max(1, Math.ceil(len / stepM))
    for (let k = 0; k < n; k++) {
      const t = k / n
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  if (out.length) out.push([out[0][0], out[0][1]])
  return out
}

function pointInRing(ring, x, y) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]
    if (yi > y !== yj > y) {
      const den = yj - yi
      if (den !== 0 && x < ((xj - xi) * (y - yi)) / den + xi) inside = !inside
    }
  }
  return inside
}

function firstRayHit(ring, origin, dir, eps, skipEdge) {
  let bestT = Infinity
  let best = null
  const n = ring.length - 1
  for (let i = 0; i < n; i++) {
    let d = Math.abs(i - skipEdge)
    d = Math.min(d, n - d)
    if (d <= 2) continue
    const a = ring[i]
    const b = ring[i + 1]
    const rx = b[0] - a[0]
    const ry = b[1] - a[1]
    const det = dir[0] * ry - dir[1] * rx
    if (Math.abs(det) < 1e-12) continue
    const ax = a[0] - origin[0]
    const ay = a[1] - origin[1]
    const t = (ax * ry - ay * rx) / det
    const u = (ax * dir[1] - ay * dir[0]) / det
    if (t < eps || u < 0 || u > 1) continue
    if (t < bestT) {
      bestT = t
      best = { t, point: [origin[0] + dir[0] * t, origin[1] + dir[1] * t], edge: i }
    }
  }
  return best
}

function segmentIntersectParam(p, d, a, b) {
  const rx = b[0] - a[0]
  const ry = b[1] - a[1]
  const det = d[0] * ry - d[1] * rx
  if (Math.abs(det) < 1e-12) return null
  const ax = a[0] - p[0]
  const ay = a[1] - p[1]
  const t = (ax * ry - ay * rx) / det
  const u = (ax * d[1] - ay * d[0]) / det
  if (u < 0 || u > 1) return null
  return t
}

/** Longest interior chord of line p + t*dir through ring (holes subtracted). */
function crossSectionWidth(ring, holes, p, dir) {
  const ts = []
  for (let i = 0; i < ring.length - 1; i++) {
    const t = segmentIntersectParam(p, dir, ring[i], ring[i + 1])
    if (t != null) ts.push(t)
  }
  ts.sort((a, b) => a - b)
  const uniq = []
  for (const t of ts) {
    if (!uniq.length || Math.abs(t - uniq[uniq.length - 1]) > 0.05) uniq.push(t)
  }
  let best = 0
  for (let i = 0; i + 1 < uniq.length; i += 2) {
    let w = Math.abs(uniq[i + 1] - uniq[i])
    const midT = (uniq[i] + uniq[i + 1]) / 2
    const mx = p[0] + dir[0] * midT
    const my = p[1] + dir[1] * midT
    if (holes.some((h) => pointInRing(h, mx, my))) continue
    if (w > best) best = w
  }
  return best
}

function pcaAlong(points) {
  let mx = 0
  let my = 0
  for (const [x, y] of points) {
    mx += x
    my += y
  }
  mx /= points.length
  my /= points.length
  let cxx = 0
  let cxy = 0
  let cyy = 0
  for (const [x, y] of points) {
    const dx = x - mx
    const dy = y - my
    cxx += dx * dx
    cxy += dx * dy
    cyy += dy * dy
  }
  const n = points.length
  cxx /= n
  cxy /= n
  cyy /= n
  const trace = cxx + cyy
  const det = cxx * cyy - cxy * cxy
  const gap = Math.sqrt(Math.max(0, (trace * trace) / 4 - det))
  const l1 = trace / 2 + gap
  let ax = cxy
  let ay = l1 - cxx
  if (Math.abs(ax) + Math.abs(ay) < 1e-12) {
    ax = l1 - cyy
    ay = cxy
  }
  const len = Math.hypot(ax, ay) || 1
  return { mean: [mx, my], along: [ax / len, ay / len] }
}

/** Collect bank→bank midpoints used as centerline seeds. */
function bankMidpoints(ring0, holes, densified) {
  const n = densified.length - 1
  const stride = Math.max(1, Math.round(BANK_STEP_M / DENSIFY_M))
  const mids = []
  for (let i = 0; i < n; i += stride) {
    const prev = densified[(i - 1 + n) % n]
    const cur = densified[i]
    const next = densified[(i + 1) % n]
    const tx = next[0] - prev[0]
    const ty = next[1] - prev[1]
    const tlen = Math.hypot(tx, ty)
    if (tlen < 1e-6) continue
    let nx = -ty / tlen
    let ny = tx / tlen
    if (!pointInRing(ring0, cur[0] + nx * 2, cur[1] + ny * 2)) {
      nx = -nx
      ny = -ny
      if (!pointInRing(ring0, cur[0] + nx * 2, cur[1] + ny * 2)) continue
    }
    const hit = firstRayHit(densified, cur, [nx, ny], 3, i)
    if (!hit || hit.t < MIN_WIDTH_M || hit.t > MAX_WIDTH_M) continue
    const rev = firstRayHit(densified, hit.point, [-nx, -ny], 3, hit.edge)
    if (!rev) continue
    if (Math.hypot(rev.point[0] - cur[0], rev.point[1] - cur[1]) > REVERSE_TOL_M) continue
    const mid = [(cur[0] + hit.point[0]) / 2, (cur[1] + hit.point[1]) / 2]
    if (!pointInRing(ring0, mid[0], mid[1])) continue
    if (holes.some((h) => pointInRing(h, mid[0], mid[1]))) continue
    mids.push({ mid, seedW: hit.t })
  }
  return mids
}

function thinCenterline(mids) {
  if (mids.length < 2) return mids.map((m) => m.mid)
  const pts = mids.map((m) => m.mid)
  const { mean, along } = pcaAlong(pts)
  const ordered = mids
    .map((m) => ({
      ...m,
      t: (m.mid[0] - mean[0]) * along[0] + (m.mid[1] - mean[1]) * along[1],
    }))
    .sort((a, b) => a.t - b.t)

  const kept = [ordered[0]]
  for (let i = 1; i < ordered.length; i++) {
    const prev = kept[kept.length - 1].mid
    const cur = ordered[i].mid
    if (Math.hypot(cur[0] - prev[0], cur[1] - prev[1]) >= CENTER_STEP_M * 0.85) {
      kept.push(ordered[i])
    }
  }
  return kept.map((k) => k.mid)
}

function estimatePolygonPart(ringsLngLat) {
  const exterior = ensureClosed(ringsLngLat[0])
  if (exterior.length < 4) return null

  let lon0 = 0
  let lat0 = 0
  const nOpen = exterior.length - 1
  for (let i = 0; i < nOpen; i++) {
    lon0 += exterior[i][0]
    lat0 += exterior[i][1]
  }
  lon0 /= nOpen
  lat0 /= nOpen

  const ring0 = projectRing(exterior, lon0, lat0)
  const holes = ringsLngLat.slice(1).map((h) => ensureClosed(projectRing(h, lon0, lat0)))
  const area = ringAreaM2(ring0) - holes.reduce((s, h) => s + ringAreaM2(h), 0)
  if (area < MIN_AREA_M2) return { skip: 'tiny_area', area }

  const perim = ringPerimeterM(ring0)
  if (perim < MIN_PERIM_M) return { skip: 'short_perim', perim, area }

  const approxW = (4 * area) / perim
  if (approxW > MAX_BLOB_WIDTH_M) {
    return { skip: 'blob_polygon', approxW, area, perim }
  }

  // Cap densify length to keep runtime bounded on huge ribbons
  const densifyStep = perim > 80_000 ? 30 : DENSIFY_M
  const densified = densifyRing(ring0, densifyStep)
  const seeds = bankMidpoints(ring0, holes, densified)
  if (seeds.length < MIN_SAMPLES) {
    return { skip: 'few_seeds', sampleCount: seeds.length, approxW }
  }

  const center = thinCenterline(seeds)
  const raw = []
  const midPts = []

  for (let i = 0; i < center.length; i++) {
    const p = center[i]
    let tx
    let ty
    if (i === 0 && center.length > 1) {
      tx = center[1][0] - center[0][0]
      ty = center[1][1] - center[0][1]
    } else if (i === center.length - 1) {
      tx = center[i][0] - center[i - 1][0]
      ty = center[i][1] - center[i - 1][1]
    } else {
      tx = center[i + 1][0] - center[i - 1][0]
      ty = center[i + 1][1] - center[i - 1][1]
    }
    const tlen = Math.hypot(tx, ty)
    if (tlen < 1e-6) continue
    const across = [-ty / tlen, tx / tlen]
    const w = crossSectionWidth(ring0, holes, p, across)
    if (w >= MIN_WIDTH_M && w <= MAX_WIDTH_M) {
      raw.push(w)
      midPts.push(p)
    }
  }

  // Fallback: seed widths if centerline cross-sections sparse
  if (raw.length < MIN_SAMPLES) {
    for (const s of seeds) {
      if (s.seedW >= MIN_WIDTH_M && s.seedW <= MAX_WIDTH_M) {
        raw.push(s.seedW)
        midPts.push(s.mid)
      }
    }
  }

  if (raw.length < MIN_SAMPLES) {
    return { skip: 'few_samples', sampleCount: raw.length, approxW }
  }

  const sorted0 = [...raw].sort((a, b) => a - b)
  const p75 = percentile(sorted0, 0.75)
  const cap = Math.min(MAX_WIDTH_M, Math.max(p75 * 2.5, percentile(sorted0, 0.9) * 1.5))
  const sorted = raw.filter((w) => w <= cap).sort((a, b) => a - b)
  if (sorted.length < MIN_SAMPLES) return { skip: 'few_after_cap', sampleCount: sorted.length }

  const p10 = percentile(sorted, 0.1)
  const p50 = percentile(sorted, 0.5)
  const p90 = percentile(sorted, 0.9)
  const ratio = p10 > 0 ? p90 / p10 : Infinity
  const confidence = sorted.length >= 5 && ratio < 3 ? 'high' : 'medium'

  const mid = midPts[Math.floor(midPts.length / 2)]
  const { lat, lng } = unproject(mid[0], mid[1], lon0, lat0)

  return {
    widthM: Math.round(p50),
    widthP50M: Math.round(p50),
    widthP10M: Math.round(p10),
    widthP90M: Math.round(p90),
    sampleCount: sorted.length,
    lat,
    lng,
    confidence,
    approxW: Math.round(approxW),
    areaM2: Math.round(area),
  }
}

function polygonParts(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates]
  if (geom.type === 'MultiPolygon') return geom.coordinates
  return []
}

function matchesPriority(name) {
  return PRIORITY_NAME_RE.test(name || '')
}

async function main() {
  const gj = JSON.parse(await readFile(SHAPES, 'utf8'))
  const features = []
  let considered = 0
  let skipped = 0
  const skipReasons = {}

  for (const f of gj.features || []) {
    const geom = f.geometry
    if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) continue
    const p = f.properties || {}
    const water = String(p.water || '').toLowerCase()
    if (!WATER_OK.has(water)) continue
    if (p.lat == null || p.lng == null || !inMapExtent(p.lat, p.lng)) continue

    const nameUk = p.nameUk || p.name || null
    if (priorityOnly && !matchesPriority(nameUk)) continue
    considered++

    const partResults = []
    for (const rings of polygonParts(geom)) {
      const est = estimatePolygonPart(rings)
      if (!est) continue
      if (est.skip) {
        skipReasons[est.skip] = (skipReasons[est.skip] || 0) + 1
        continue
      }
      partResults.push(est)
    }

    if (!partResults.length) {
      skipped++
      continue
    }

    // Prefer the elongated river-like part (more samples, lower approxW)
    partResults.sort((a, b) => {
      const sa = a.sampleCount / (1 + (a.approxW || 0) / 100)
      const sb = b.sampleCount / (1 + (b.approxW || 0) / 100)
      return sb - sa
    })
    const best = partResults[0]

    features.push({
      osmId: p.osmId,
      nameUk,
      widthM: best.widthM,
      widthP50M: best.widthP50M,
      widthP10M: best.widthP10M,
      sampleCount: best.sampleCount,
      lat: Number(best.lat.toFixed(5)),
      lng: Number(best.lng.toFixed(5)),
      confidence: best.confidence,
      noteUk: null,
    })
  }

  features.sort((a, b) => (b.widthM || 0) - (a.widthM || 0))

  const doc = {
    methodId: 'osm_polygon',
    priority: 2,
    collectedAt: new Date().toISOString(),
    methodNoteUk: 'orthogonal samples on OSM polygons',
    features,
  }

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(OUT, JSON.stringify(doc, null, 2) + '\n', 'utf8')

  console.log(
    JSON.stringify(
      {
        out: OUT,
        priorityOnly,
        considered,
        skipped,
        skipReasons,
        featureCount: features.length,
        top: features.slice(0, 10).map((f) => ({
          nameUk: f.nameUk,
          widthM: f.widthM,
          p10: f.widthP10M,
          n: f.sampleCount,
          c: f.confidence,
        })),
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
