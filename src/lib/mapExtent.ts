/**
 * Operational map extent for Kyiv oblast paddling map.
 * North cut ~51.28 removes Belarus border belt + deep Chernihiv spill.
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

export const MAP_CENTER: [number, number] = [30.52, 50.45] // lng, lat (MapLibre order)
export const MAP_ZOOM = 9
