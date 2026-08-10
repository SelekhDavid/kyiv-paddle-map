export type RestrictionLevel =
  | 'banned_navigation'
  | 'oblast_ban'
  | 'restricted'
  | 'check_local'
  | 'likely_ok'

/** Shell spot model (curated spots.json). Full enrichment lands later. */
export interface Spot {
  id: string
  nameUk: string
  nameEn: string
  lat: number
  lng: number
  kind: string
  region: string
  derived?: boolean
  matchedOsmId?: string
  matchedOsmIds?: string[]
  matchedOsmNameUk?: string
  restriction: {
    level: RestrictionLevel
    labelUk: string
    notesUk?: string
  }
  touristLoad?: {
    grade: 1 | 2 | 3 | 4 | 5
  }
}
