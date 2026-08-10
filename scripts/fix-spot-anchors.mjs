/**
 * Snap standing curated spots to polylabel interior of matched OSM polygons.
 * Usage: node scripts/fix-spot-anchors.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import polylabel from '@mapbox/polylabel'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const spotsPath = join(root, 'public/data/spots.json')
const shapesPath = join(root, 'public/data/water-shapes.geojson')

function isStanding(kind) {
  return /^(lake|pond|reservoir|quarry|basin|oxbow)$/i.test(kind)
}

function idsOf(s) {
  if (s.matchedOsmIds?.length) return s.matchedOsmIds
  if (s.matchedOsmId) return [s.matchedOsmId]
  return []
}

function interior(geometry) {
  if (geometry.type === 'Polygon') {
    const [lng, lat] = polylabel(geometry.coordinates, 0.0001)
    return { lat, lng }
  }
  if (geometry.type === 'MultiPolygon') {
    let best = null
    for (const poly of geometry.coordinates) {
      const r = polylabel(poly, 0.0001)
      const score = r[2] ?? 0
      if (!best || score > best.score) best = { lng: r[0], lat: r[1], score }
    }
    return best ? { lat: best.lat, lng: best.lng } : null
  }
  return null
}

const spots = JSON.parse(readFileSync(spotsPath, 'utf8'))
const shapes = JSON.parse(readFileSync(shapesPath, 'utf8'))
const byOsm = new Map(shapes.features.map((f) => [f.properties.osmId, f]))

let updated = 0
let missing = 0
for (const s of spots) {
  if (!isStanding(s.kind)) continue
  const ids = idsOf(s)
  if (!ids.length) {
    missing++
    continue
  }
  let pt = null
  for (const id of ids) {
    const f = byOsm.get(id)
    if (!f) continue
    pt = interior(f.geometry)
    if (pt) break
  }
  if (!pt) {
    missing++
    continue
  }
  const dLat = Math.abs(s.lat - pt.lat)
  const dLng = Math.abs(s.lng - pt.lng)
  if (dLat > 1e-5 || dLng > 1e-5) {
    s.lat = Number(pt.lat.toFixed(6))
    s.lng = Number(pt.lng.toFixed(6))
    updated++
  }
}

writeFileSync(spotsPath, `${JSON.stringify(spots, null, 2)}\n`)
console.log(`Updated ${updated} standing anchors; ${missing} without poly bind/geometry`)
