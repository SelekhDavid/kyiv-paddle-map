import type { ClassificationDoc, RestrictionLevel, Spot, WaterShapeFeature } from '../types'
import { RESTRICTION_LABELS } from './labels'

/**
 * Operational map extent for Kyiv oblast paddling map.
 * North cut ~51.28 removes Belarus border belt + deep Chernihiv spill of Desna/etc.
 * (official oblast tip reaches ~51.5 near the frontier — we intentionally omit that strip.)
 */
export const MAP_EXTENT = {
  south: 49.85,
  west: 29.2,
  north: 51.28,
  east: 32.3,
} as const

export function inMapExtent(lat: number, lng: number): boolean {
  return (
    lat >= MAP_EXTENT.south &&
    lat <= MAP_EXTENT.north &&
    lng >= MAP_EXTENT.west &&
    lng <= MAP_EXTENT.east
  )
}

/** Keep feature if its representative point is inside extent. */
export function filterFeaturesToMapExtent(features: WaterShapeFeature[]): WaterShapeFeature[] {
  return features.filter((f) => {
    const lat = f.properties.lat
    const lng = f.properties.lng
    if (lat == null || lng == null) return false
    return inMapExtent(lat, lng)
  })
}

export function osmRiverSpotId(osmId: string): string {
  return `osm-river-${osmId}`
}

export function parseOsmRiverSpotId(id: string): string | null {
  if (!id.startsWith('osm-river-')) return null
  return id.slice('osm-river-'.length)
}

/** Ephemeral Spot for clicking a river segment that has no curated/list entry. */
export function spotFromRiverFeature(
  f: WaterShapeFeature,
  classification: ClassificationDoc | null,
): Spot {
  const osmId = f.properties.osmId
  const entry = classification?.features[osmId]
  const level: RestrictionLevel = entry?.level ?? 'likely_ok'
  const name = entry?.name || f.properties.nameUk || f.properties.name || 'Річка'
  const checked = classification?.checkedAt
  const reason =
    entry?.reasonUk ||
    'Статус для цієї ділянки річки складено за відкритими правилами громад. Перед виходом перевірте актуальні місцеві обмеження.'

  return {
    id: osmRiverSpotId(osmId),
    nameUk: name,
    nameEn: name,
    lat: f.properties.lat,
    lng: f.properties.lng,
    kind: 'river',
    region: 'Київська область · ділянка річки',
    osmHint: name,
    paddleSuitability: 'good_when_allowed',
    swimSuitability: 'moderate',
    restriction: {
      level,
      labelUk: RESTRICTION_LABELS[level],
      labelEn: level,
      notesUk: checked ? `${reason} Перевірено станом на ${checked}.` : reason,
      sources: [],
    },
    touristLoad: {
      grade: 2,
      labelUk: 'окрема ділянка',
      basis: 'OSM LineString click',
      peakHintUk: 'див. статус ділянки вище',
      sources: ['classification.json'],
      updated: checked?.slice(0, 7) || '2026-08',
    },
    amenities: ['nature'],
    accessUk: 'Дивіться під’їзди на місці',
    tipsUk: 'Цей статус стосується лише вибраної ділянки лінії, а не всієї річки від витоку до гирла.',
    derived: true,
    matchedOsmId: osmId,
  }
}
