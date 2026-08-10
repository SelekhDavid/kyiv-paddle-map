import polylabel from '@mapbox/polylabel'
import type { Spot } from './types'

export function isStandingWaterKind(kind: string): boolean {
  return /^(lake|pond|reservoir|quarry|basin|oxbow)$/i.test(kind)
}

export function spotMatchedOsmIds(spot: Spot): string[] {
  if (spot.matchedOsmIds?.length) return [...spot.matchedOsmIds]
  if (spot.matchedOsmId) return [spot.matchedOsmId]
  return []
}

type Ring = number[][]
type PolygonCoords = Ring[]
type MultiPolygonCoords = PolygonCoords[]

function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
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

function pointInPolygon(lng: number, lat: number, polygon: PolygonCoords): boolean {
  if (!polygon.length || !pointInRing(lng, lat, polygon[0]!)) return false
  for (let h = 1; h < polygon.length; h++) {
    if (pointInRing(lng, lat, polygon[h]!)) return false
  }
  return true
}

/** Pole of inaccessibility for a Polygon / MultiPolygon (lng/lat). */
export function interiorPointForShape(geometry: {
  type: string
  coordinates: unknown
}): { lat: number; lng: number } | null {
  if (geometry.type === 'Polygon') {
    const poly = geometry.coordinates as PolygonCoords
    if (!poly?.[0]?.length) return null
    const [lng, lat] = polylabel(poly, 0.0001) as [number, number]
    if (pointInPolygon(lng, lat, poly)) return { lat, lng }
    // fallback: first ring average clipped naively
    const ring = poly[0]!
    let sx = 0
    let sy = 0
    const n = Math.max(ring.length - 1, 1)
    for (let i = 0; i < n; i++) {
      sx += ring[i]![0]!
      sy += ring[i]![1]!
    }
    return { lng: sx / n, lat: sy / n }
  }
  if (geometry.type === 'MultiPolygon') {
    const mp = geometry.coordinates as MultiPolygonCoords
    let best: { lat: number; lng: number; score: number } | null = null
    for (const poly of mp) {
      if (!poly?.[0]?.length) continue
      const [lng, lat, dist] = polylabel(poly, 0.0001) as [number, number, number?]
      const score = dist ?? 0
      if (!best || score > best.score) best = { lat, lng, score }
    }
    return best ? { lat: best.lat, lng: best.lng } : null
  }
  return null
}

export interface ShapeLike {
  properties: { osmId: string; kind?: string; lat?: number; lng?: number }
  geometry: { type: string; coordinates: unknown }
}

/** Prefer explicit matched OSM polys; snap standing spots to interior. */
export function applyInteriorAnchors<T extends Spot>(
  spots: T[],
  shapes: ShapeLike[],
): T[] {
  const byOsm = new Map(shapes.map((f) => [f.properties.osmId, f]))
  return spots.map((s) => {
    if (!isStandingWaterKind(s.kind)) return s
    const ids = spotMatchedOsmIds(s)
    if (!ids.length) return s
    // largest ring area proxy: try each, keep first successful interior
    for (const id of ids) {
      const f = byOsm.get(id)
      if (!f) continue
      const g = f.geometry
      if (g.type !== 'Polygon' && g.type !== 'MultiPolygon') continue
      const pt = interiorPointForShape(g)
      if (pt) {
        return {
          ...s,
          lat: pt.lat,
          lng: pt.lng,
          matchedOsmId: ids[0],
          matchedOsmIds: ids,
        }
      }
    }
    return s
  })
}
