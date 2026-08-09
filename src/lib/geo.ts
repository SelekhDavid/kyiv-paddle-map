import type { PathOptions } from 'leaflet'
import type { RestrictionLevel, Spot, WaterShapeFeature } from '../types'
import { RESTRICTION_COLORS } from './labels'

const NORM = (s: string) =>
  s
    .toLowerCase()
    .replace(/озеро|водосховище|ставок|кар[ʼ'′]єр|річка|река/gi, '')
    .replace(/[^a-zа-яёіїєґ0-9]/gi, '')

/** Standing water — never primary-bind to river LineStrings (methodology-waterbody-display). */
export function isStandingWaterKind(kind: string): boolean {
  return /^(lake|pond|reservoir|quarry|basin|oxbow)$/i.test(kind)
}

export function isRiverishKind(kind: string): boolean {
  return /river|bay|channel/i.test(kind)
}

/** Explicit group ids, else single matchedOsmId. */
export function spotMatchedOsmIds(spot: Spot): string[] {
  if (spot.matchedOsmIds?.length) return spot.matchedOsmIds
  return spot.matchedOsmId ? [spot.matchedOsmId] : []
}

export function centroidOfLatLngs(
  points: Array<{ lat?: number | null; lng?: number | null }>,
): { lat: number; lng: number } | null {
  let n = 0
  let lat = 0
  let lng = 0
  for (const p of points) {
    if (p.lat == null || p.lng == null) continue
    lat += p.lat
    lng += p.lng
    n += 1
  }
  return n ? { lat: lat / n, lng: lng / n } : null
}

/** Ray-casting; ring is GeoJSON [lng, lat][], may be closed. */
export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false
  const n = ring.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i]![0]!
    const yi = ring[i]![1]!
    const xj = ring[j]![0]!
    const yj = ring[j]![1]!
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** Polygon coords: [outer, ...holes] in GeoJSON order. */
export function pointInPolygonCoords(lng: number, lat: number, polygon: number[][][]): boolean {
  const outer = polygon[0]
  if (!outer || outer.length < 3) return false
  if (!pointInRing(lng, lat, outer)) return false
  for (let h = 1; h < polygon.length; h++) {
    const hole = polygon[h]
    if (hole && hole.length >= 3 && pointInRing(lng, lat, hole)) return false
  }
  return true
}

function ringVertexMean(ring: number[][]): { lat: number; lng: number } | null {
  const n = ring.length
  if (n < 2) return null
  const closed =
    ring[0]![0] === ring[n - 1]![0] && ring[0]![1] === ring[n - 1]![1]
  const end = closed ? n - 1 : n
  if (end < 1) return null
  let lng = 0
  let lat = 0
  for (let i = 0; i < end; i++) {
    lng += ring[i]![0]!
    lat += ring[i]![1]!
  }
  return { lat: lat / end, lng: lng / end }
}

function ringBBox(ring: number[][]): { minLng: number; maxLng: number; minLat: number; maxLat: number } | null {
  if (!ring.length) return null
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  for (const pt of ring) {
    const lng = pt[0]!
    const lat = pt[1]!
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  if (!Number.isFinite(minLng)) return null
  return { minLng, maxLng, minLat, maxLat }
}

function roughRingArea(ring: number[][]): number {
  // Planar shoelace in deg² — enough to pick largest multipolygon part
  let a = 0
  const n = ring.length
  for (let i = 0; i < n - 1; i++) {
    a += ring[i]![0]! * ring[i + 1]![1]! - ring[i + 1]![0]! * ring[i]![1]!
  }
  return Math.abs(a) * 0.5
}

/** Guaranteed-inside point for a single polygon (outer + holes). */
export function interiorPointForPolygonCoords(polygon: number[][][]): { lat: number; lng: number } | null {
  const outer = polygon[0]
  if (!outer || outer.length < 3) return null

  const mean = ringVertexMean(outer)
  if (mean && pointInPolygonCoords(mean.lng, mean.lat, polygon)) return mean

  const bbox = ringBBox(outer)
  if (!bbox) return null
  const mid = {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  }
  if (pointInPolygonCoords(mid.lng, mid.lat, polygon)) return mid

  for (let cells = 8; cells <= 48; cells *= 2) {
    for (let iy = 0; iy < cells; iy++) {
      for (let ix = 0; ix < cells; ix++) {
        const lng = bbox.minLng + ((ix + 0.5) / cells) * (bbox.maxLng - bbox.minLng)
        const lat = bbox.minLat + ((iy + 0.5) / cells) * (bbox.maxLat - bbox.minLat)
        if (pointInPolygonCoords(lng, lat, polygon)) return { lat, lng }
      }
    }
  }

  // Pull edge midpoints toward vertex-mean
  const pull = mean || mid
  const n = outer.length
  const closed =
    outer[0]![0] === outer[n - 1]![0] && outer[0]![1] === outer[n - 1]![1]
  const end = closed ? n - 1 : n
  for (let i = 0; i < end; i++) {
    const a = outer[i]!
    const b = outer[(i + 1) % end]!
    const mx = (a[0]! + b[0]!) / 2
    const my = (a[1]! + b[1]!) / 2
    for (const t of [0.15, 0.35, 0.55, 0.75]) {
      const lng = mx + (pull.lng - mx) * t
      const lat = my + (pull.lat - my) * t
      if (pointInPolygonCoords(lng, lat, polygon)) return { lat, lng }
    }
  }
  return null
}

/**
 * Marker / fly-to anchor that lies inside standing-water geometry.
 * Vertex-mean centroids often fall on land for concave lakes — use this instead.
 */
export function interiorPointForShape(f: WaterShapeFeature): { lat: number; lng: number } | null {
  const g = f.geometry
  if (g.type === 'Polygon') return interiorPointForPolygonCoords(g.coordinates)
  if (g.type === 'MultiPolygon') {
    const parts = [...g.coordinates].sort(
      (a, b) => roughRingArea(b[0] || []) - roughRingArea(a[0] || []),
    )
    for (const poly of parts) {
      const p = interiorPointForPolygonCoords(poly)
      if (p) return p
    }
    return null
  }
  // LineString — mid-vertex (not a standing body; caller should not use for lakes)
  if (g.type === 'LineString' && g.coordinates.length) {
    const mid = g.coordinates[Math.floor(g.coordinates.length / 2)]!
    return { lng: mid[0]!, lat: mid[1]! }
  }
  return null
}

/** First matched standing polygon that yields an interior point. */
export function standingAnchorOnShapes(
  spot: Spot,
  byOsm: Map<string, WaterShapeFeature>,
): { lat: number; lng: number; osmId: string } | null {
  if (!isStandingWaterKind(spot.kind)) return null
  for (const id of spotMatchedOsmIds(spot)) {
    const f = byOsm.get(id)
    if (!f) continue
    if (f.geometry.type === 'LineString') continue
    const p = interiorPointForShape(f)
    if (p) return { ...p, osmId: id }
  }
  return null
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function matchSpotToShape(spot: Spot, shapes: WaterShapeFeature[]): WaterShapeFeature | null {
  const hint = NORM(spot.osmHint || spot.nameUk)
  const standing = isStandingWaterKind(spot.kind)
  const kindRiver = isRiverishKind(spot.kind)
  let best: { f: WaterShapeFeature; score: number } | null = null
  const cosLat = Math.cos((spot.lat * Math.PI) / 180) || 0.5

  for (const f of shapes) {
    const p = f.properties
    if (p.lat == null || p.lng == null) continue
    const isPoly = f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
    const isRiverLine = f.geometry.type === 'LineString' && p.kind === 'river'

    // Standing waters → polygons only; river spots → river lines only
    if (standing && !isPoly) continue
    if (kindRiver && !isRiverLine) continue

    const maxDist = kindRiver ? 25 : 4
    // Cheap degree pre-filter before haversine (~111 km per lat degree)
    if (Math.abs(p.lat - spot.lat) > maxDist / 100) continue
    if (Math.abs(p.lng - spot.lng) * cosLat > maxDist / 100) continue
    const dist = haversineKm(spot, { lat: p.lat, lng: p.lng })
    if (dist > maxDist) continue
    const names = [p.name, p.nameUk, p.nameEn].filter(Boolean).map((n) => NORM(String(n)))
    // Empty NORM("Річка") must not give nameHit via includes("")
    const nameHit =
      hint.length > 2 &&
      names.some((n) => n.length > 2 && (n.includes(hint) || hint.includes(n)))
    // Standing waters: never bind to unnamed nearest poly (causes Kytaiv/Berkovets false snaps)
    if (standing && !nameHit) continue
    const score = (nameHit ? 100 : 0) + Math.max(0, 50 - dist * (kindRiver ? 1 : 8))
    if (!best || score > best.score) best = { f, score }
  }
  return best && best.score >= 20 ? best.f : null
}

export function shapeStyle(
  level: RestrictionLevel | null,
  selected: boolean,
  kind: string,
  zoom = 12,
): PathOptions {
  if (kind === 'river') {
    // Never default to unclassified blue when level is missing — use oblast orange
    const color = level ? RESTRICTION_COLORS[level] : RESTRICTION_COLORS.oblast_ban
    const base = zoom < 10 ? 1.4 : zoom < 12 ? 2 : 3.2
    return {
      color,
      weight: selected ? Math.max(base + 1.5, 4) : base,
      opacity: selected ? 0.95 : 0.8,
      lineCap: 'round',
      lineJoin: 'round',
    }
  }
  const color = level ? RESTRICTION_COLORS[level] : '#6a9bb8'
  return {
    color,
    fillColor: color,
    weight: selected ? 2.5 : 1.2,
    opacity: 0.9,
    fillOpacity: selected ? 0.55 : level ? 0.38 : 0.22,
  }
}

export function paddleShapeStyle(
  verdict: 'ok' | 'negative',
  selected: boolean,
  kind: string,
  zoom = 12,
): PathOptions {
  const color = verdict === 'ok' ? '#2980b9' : '#95a5a6'
  if (kind === 'river') {
    const base = zoom < 10 ? 2 : zoom < 12 ? 2.8 : 3.6
    return {
      color,
      weight: selected ? Math.max(base + 1.5, 4.5) : base,
      opacity: selected ? 0.98 : 0.88,
      lineCap: 'round',
      lineJoin: 'round',
    }
  }
  return {
    color,
    fillColor: color,
    weight: selected ? 2.5 : 1.2,
    opacity: 0.9,
    fillOpacity: selected ? 0.55 : 0.42,
  }
}

/** Detail mode: single blue for any usable width (>1 m). Keep in sync with DETAIL_RIVER_SWATCH. */
export const DETAIL_RIVER_BLUE = '#0f5a94'

export function widthShapeStyle(
  _widthM: number | null | undefined,
  selected: boolean,
  kind: string,
  zoom = 12,
): PathOptions {
  const color = DETAIL_RIVER_BLUE
  if (kind === 'river') {
    const base = zoom < 10 ? 2 : zoom < 12 ? 2.8 : 3.8
    return {
      color,
      weight: selected ? Math.max(base + 1.5, 4.5) : base,
      opacity: selected ? 1 : 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }
  }
  return {
    color,
    fillColor: color,
    weight: selected ? 2.5 : 1.4,
    opacity: 0.95,
    fillOpacity: selected ? 0.55 : 0.42,
  }
}

/** Detail mode: show only if width known and >1 m (hide OSM 1 m stubs). */
export function hasDisplayableWidth(widthM: number | null | undefined): boolean {
  return widthM != null && Number.isFinite(widthM) && widthM > 1
}

export function riverNameToken(raw: string | null | undefined): string {
  if (!raw) return ''
  return (
    String(raw)
      .toLowerCase()
      .replace(/[^a-zа-яёіїєґ\s-]/gi, ' ')
      .split(/\s+/)
      .find((t) => t.length >= 4 && !/^(річка|река|озеро|канал|водосховище)$/.test(t)) || ''
  )
}

/** Approx distance from point to segment in km (cheap flat projection). */
function pointToSegKm(
  p: { lat: number; lng: number },
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const x = p.lng
  const y = p.lat
  const x1 = a.lng
  const y1 = a.lat
  const x2 = b.lng
  const y2 = b.lat
  const dx = x2 - x1
  const dy = y2 - y1
  const len2 = dx * dx + dy * dy
  let t = len2 < 1e-18 ? 0 : ((x - x1) * dx + (y - y1) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const proj = { lat: y1 + t * dy, lng: x1 + t * dx }
  return haversineKm(p, proj)
}

/**
 * True if ≥60% of sample points on candidate are within maxM of any classified polyline.
 */
export function isNearClassifiedRiver(
  candidate: [number, number][],
  classified: Array<[number, number][]>,
  maxM = 80,
  minFraction = 0.6,
): boolean {
  if (candidate.length < 2 || classified.length === 0) return false
  const maxKm = maxM / 1000
  const step = Math.max(1, Math.floor(candidate.length / 12))
  let hits = 0
  let total = 0
  for (let i = 0; i < candidate.length; i += step) {
    const [lat, lng] = candidate[i]
    total++
    let near = false
    outer: for (const line of classified) {
      for (let j = 1; j < line.length; j++) {
        const [la1, lo1] = line[j - 1]
        const [la2, lo2] = line[j]
        if (
          pointToSegKm({ lat, lng }, { lat: la1, lng: lo1 }, { lat: la2, lng: lo2 }) <= maxKm
        ) {
          near = true
          break outer
        }
      }
    }
    if (near) hits++
  }
  return total > 0 && hits / total >= minFraction
}

export type FlowArrow = { lat: number; lng: number; bearing: number }

export type LatLngBoundsLike = {
  contains: (latlng: { lat: number; lng: number }) => boolean
  getCenter: () => { lat: number; lng: number }
}

/** Arrow spacing in km by zoom level */
export function arrowStepKm(zoom: number): number {
  if (zoom >= 15) return 1
  if (zoom >= 13) return 2
  if (zoom >= 12) return 3
  return 4 // zoom 11
}

/** Sample flow arrows every `stepKm` along the line; optional bounds filter. */
export function flowArrowSamplesByKm(
  latLngs: [number, number][],
  stepKm: number,
  bounds?: LatLngBoundsLike | null,
): FlowArrow[] {
  const out: FlowArrow[] = []
  if (latLngs.length < 2 || stepKm <= 0) return out

  let acc = 0
  let nextAt = stepKm

  for (let i = 1; i < latLngs.length; i++) {
    const [lat1, lng1] = latLngs[i - 1]
    const [lat2, lng2] = latLngs[i]
    const seg = haversineKm({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 })
    if (seg < 1e-6) continue

    const bearing = (Math.atan2(lng2 - lng1, lat2 - lat1) * 180) / Math.PI
    let remain = seg
    let t0 = 0

    while (acc + remain >= nextAt) {
      const need = nextAt - acc
      const t = t0 + need / seg
      const lat = lat1 + (lat2 - lat1) * t
      const lng = lng1 + (lng2 - lng1) * t
      const pt = { lat, lng }
      if (!bounds || bounds.contains(pt)) {
        out.push({ lat, lng, bearing })
      }
      nextAt += stepKm
      t0 = t
      remain = seg - t0 * seg
      acc = nextAt - stepKm
    }
    acc += remain
  }
  return out
}

/** Keep at most `max` arrows closest to bounds center. Preserves extra fields via generics. */
export function capFlowArrows<T extends FlowArrow>(
  arrows: T[],
  bounds: LatLngBoundsLike | null,
  max = 100,
): T[] {
  if (arrows.length <= max) return arrows
  if (!bounds) return arrows.slice(0, max)
  const c = bounds.getCenter()
  return [...arrows]
    .sort((a, b) => haversineKm(a, c) - haversineKm(b, c))
    .slice(0, max)
}

/** @deprecated point-index sampling — prefer flowArrowSamplesByKm */
export function flowArrowSamples(
  latLngs: [number, number][],
  step = 10,
): FlowArrow[] {
  const out: FlowArrow[] = []
  if (latLngs.length < 2) return out
  for (let i = step; i < latLngs.length - 1; i += step) {
    const [lat1, lng1] = latLngs[i - 1]
    const [lat2, lng2] = latLngs[i]
    const bearing = (Math.atan2(lng2 - lng1, lat2 - lat1) * 180) / Math.PI
    out.push({ lat: lat2, lng: lng2, bearing })
  }
  return out
}
