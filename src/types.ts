export type RestrictionLevel =
  | 'banned_navigation'
  | 'oblast_ban'
  | 'restricted'
  | 'check_local'
  | 'likely_ok'

/** Club/SUP trip-report verdict for "де поплавати" mode */
export type PaddleVerdict = 'ok' | 'negative'

export type MapMode = 'restrictions' | 'paddle' | 'detail'

export type PaddleSuitability =
  | 'excellent'
  | 'good'
  | 'moderate'
  | 'excellent_when_allowed'
  | 'good_when_allowed'
  | 'moderate_when_allowed'
  | 'poor'

export interface PaddleReportRef {
  title: string
  url: string
  year?: number | null
  type?: string
  hazardsUk?: string[]
}

export interface Spot {
  id: string
  nameUk: string
  nameEn: string
  lat: number
  lng: number
  kind: string
  region: string
  osmHint?: string
  paddleSuitability: PaddleSuitability
  swimSuitability: string
  restriction: {
    level: RestrictionLevel
    labelUk: string
    labelEn: string
    notesUk: string
    sources: string[]
  }
  touristLoad: {
    grade: 1 | 2 | 3 | 4 | 5
    labelUk: string
    basis: string
    peakHintUk: string
    sources: string[]
    updated: string
  }
  amenities: string[]
  accessUk: string
  tipsUk: string
  /** When true, entry was derived from OSM shape (not hand-curated) */
  derived?: boolean
  /** Primary OSM geometry (first of matchedOsmIds when group) */
  matchedOsmId?: string
  /** Lake/cascade group: all OSM polygons belonging to this spot */
  matchedOsmIds?: string[]
  /** OSM name of primary matched poly (when it differs from nameUk) */
  matchedOsmNameUk?: string
  /** Set from club-trip-reports.json when reports exist */
  paddleVerdict?: PaddleVerdict
  paddleReports?: PaddleReportRef[]
  paddleNotesUk?: string
}

export interface RulesDoc {
  updated: string
  disclaimerUk: string
  disclaimerEn: string
  regionalRules: Array<{
    id: string
    titleUk: string
    level: RestrictionLevel
    appliesTo: string[]
    summaryUk: string
    sources: Array<{ title: string; url: string }>
  }>
  touristLoadMethod: {
    approachUk: string
    scale: Record<string, string>
  }
}

export interface WaterShapeProperties {
  osmId: string
  name: string | null
  nameUk: string | null
  nameEn: string | null
  kind: string
  water: string
  flow?: string
  lat: number
  lng: number
  source: string
}

export interface WaterShapeFeature {
  type: 'Feature'
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'MultiPolygon'; coordinates: number[][][][] }
    | { type: 'LineString'; coordinates: number[][] }
  properties: WaterShapeProperties
}

export interface WaterShapeCollection {
  type: 'FeatureCollection'
  generatedAt?: string
  features: WaterShapeFeature[]
}

/** @deprecated point layer kept for optional debug */
export interface OsmWaterFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    osmId: string
    name: string
    nameUk: string | null
    nameEn: string | null
    water: string
    leisure: string | null
    access: string | null
    source: string
  }
}

export interface OsmWaterCollection {
  type: 'FeatureCollection'
  generatedAt?: string
  features: OsmWaterFeature[]
}

export interface ClassificationEntry {
  level: RestrictionLevel
  reasonUk: string
  sourceIds: string[]
  name?: string | null
  lat?: number
  lng?: number
}

export interface ClassificationDoc {
  checkedAt: string
  generatedAt?: string
  method: string
  metaCheckedAt?: string | null
  counts?: Record<string, number>
  features: Record<string, ClassificationEntry>
}

export interface ClassificationMetaDoc {
  checkedAt: string
  generatedAt?: string
  method?: string
  sources?: Array<{
    id: string
    title: string
    url: string
    fetchedAt: string
    httpStatus: number
    signals: string[]
    ok?: boolean
  }>
  derivedRules?: Array<{
    id: string
    active: boolean
    level: RestrictionLevel | null
    noteUk?: string
    communities?: string[]
  }>
}

export interface Filters {
  mapMode: MapMode
  showBanned: boolean
  showRestricted: boolean
  showCheckLocal: boolean
  showAllShapes: boolean
  showFlow: boolean
  /** Detail mode only */
  showHazards: boolean
  /** Detail mode only */
  showHydroPosts: boolean
  /** Detail mode only — Плесо / МОЗ / ЦКПХ sample sites */
  showWaterQuality: boolean
  /** Detail mode only */
  showIncidents: boolean
  maxTouristLoad: number
  search: string
  kinds: {
    lake: boolean
    river: boolean
    reservoir: boolean
    quarry: boolean
    pond: boolean
    basin: boolean
    other: boolean
  }
}

export type RiverHazardKind =
  | 'dam'
  | 'weir'
  | 'waterfall'
  | 'lock'
  | 'sluice'
  | 'rapids'
  | 'culvert'
  | 'drain'
  | 'ditch'
  | 'wastewater'
  | 'other'

export interface RiverHazard {
  id: string
  kind: RiverHazardKind
  labelUk: string
  name?: string | null
  lat: number
  lng: number
  hostRiverOsmId: string
  hostRiverName?: string | null
  snapKm?: number
  source?: string
}

export interface RiverHazardsDoc {
  generatedAt?: string
  method?: string
  snapKmMax?: number
  counts?: { total?: number; byKind?: Record<string, number> }
  features: RiverHazard[]
}

/** Hydropost catalog entry — see docs/methodology-hydro-posts.md */
export type HydroStationKind = 'daily' | 'auto'

export interface HydroStation {
  id: string
  nameUk: string
  riverUk?: string | null
  basinUk?: string | null
  lat: number
  lng: number
  kind: HydroStationKind
  feedKinds?: HydroStationKind[]
  /** Manual paddlability stubs (cm above gauge zero); not applied in UI yet */
  thresholdsCm?: { low: number | null; normal: number | null; high: number | null }
  hostRiverOsmId?: string | null
  sourceUrl?: string | null
  priorityRiver?: boolean
}

export interface HydroObservation {
  levelCm: number | null
  observedAt: string | null
  tempC?: number | null
  changeCm?: number | null
  balticSystemM?: number | null
}

export interface HydroPostsDoc {
  schemaVersion: number
  updatedAt?: string
  fetchedAt?: string
  source?: {
    provider?: string
    noteUk?: string
    endpoints?: string[]
    officialUi?: string[]
  }
  bbox?: { south: number; west: number; north: number; east: number }
  counts?: Record<string, number>
  stations: HydroStation[]
  observations: Record<string, HydroObservation>
}

/** Station + latest observation joined for the map layer */
export interface HydroPostMarker extends HydroStation {
  levelCm: number | null
  observedAt: string | null
  tempC?: number | null
  changeCm?: number | null
}

/** Bathing / lab sample status — see docs/methodology-water-quality-incidents.md */
export type WaterQualityStatus = 'ok' | 'advisory' | 'unsafe' | 'unknown'

export type WaterSampleSiteKind = 'beach' | 'water_body' | 'intake' | 'other'

export type WaterQualityConfidence = 'high' | 'medium' | 'low'

export interface WaterQualitySourceRef {
  id: string
  nameUk: string
  role?: string
  urls?: string[]
  noteUk?: string
}

/** GIS catalog flag — never treat as a lab result (see methodology) */
export interface WaterSampleSiteCatalog {
  /** ArcGIS `beachstatus` 1=Так / 0=Ні («Чи можна купатись») */
  canBatheFlag?: boolean | null
  flagSource?: string | null
  flagUpdatedAt?: string | null
}

export interface WaterSampleSite {
  id: string
  nameUk: string
  lat: number | null
  lng: number | null
  kind: WaterSampleSiteKind
  /** Primary curated spots.json id (strong match only) */
  spotId?: string | null
  /** Strong spot matches only; partial/weak live in noteUk */
  spotIds?: string[]
  waterBodyUk?: string | null
  hostRiverOsmId?: string | null
  regionUk?: string | null
  sourceIds?: string[]
  /** e.g. pleso / gis */
  provider?: string | null
  /** ArcGIS globalid when known */
  gisGlobalId?: string | null
  /** Catalog infra flag (separate from observations.*) */
  catalog?: WaterSampleSiteCatalog
  noteUk?: string | null
  placeholder?: boolean
}

/** Lab table dimensions (ЦКПХ); optional — older snapshots omit dims */
export type WaterQualityDimResult = 'pass' | 'fail' | 'unknown'

export interface WaterQualityDims {
  sanitaryChemical?: WaterQualityDimResult
  microbiological?: WaterQualityDimResult
  parasitological?: WaterQualityDimResult
}

export type WaterQualitySourceKind =
  | 'phc_brief'
  | 'cdc_table'
  | 'cdc_news'
  | 'pleso_press'
  | 'davr'
  | 'mepr'
  | 'other'

export interface WaterQualityObservation {
  status: WaterQualityStatus
  labelUk?: string | null
  sampledAt?: string | null
  /** Publish date of brief/press (ISO date), distinct from lab sampledAt */
  publishedAt?: string | null
  metricsNoteUk?: string | null
  confidence?: WaterQualityConfidence | null
  sourceUrls?: string[]
  /** e.g. ЦКПХ / КП «Плесо» / ЦГЗ */
  authority?: string | null
  labName?: string | null
  sourceKind?: WaterQualitySourceKind | null
  dims?: WaterQualityDims
  seasonOfficiallyOpen?: boolean | null
  placeholder?: boolean
}

/** Optional per-river rollup keyed by riverNameToken (plan § named rivers) */
export interface WaterQualityRiverRollup {
  status: WaterQualityStatus
  labelUk?: string | null
  sampledAt?: string | null
  noteUk?: string | null
  sourceUrls?: string[]
  placeholder?: boolean
}

export interface WaterQualityDoc {
  schemaVersion: number
  updatedAt?: string
  fetchedAt?: string | null
  bbox?: { south: number; west: number; north: number; east: number }
  sources: WaterQualitySourceRef[]
  sampleSites: WaterSampleSite[]
  observations: Record<string, WaterQualityObservation>
  byRiverNameToken?: Record<string, WaterQualityRiverRollup>
}

export type WaterIncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

export type WaterIncidentStatus = 'active' | 'resolved' | 'monitoring'

export interface WaterIncident {
  id: string
  titleUk: string
  severity: WaterIncidentSeverity
  status: WaterIncidentStatus
  startedAt?: string | null
  endedAt?: string | null
  lat?: number | null
  lng?: number | null
  waterBodyUk?: string | null
  spotIds?: string[]
  sampleSiteIds?: string[]
  hostRiverOsmId?: string | null
  summaryUk?: string | null
  sourceUrls?: string[]
  placeholder?: boolean
}

export interface WaterIncidentsDoc {
  schemaVersion: number
  updatedAt?: string
  fetchedAt?: string | null
  bbox?: { south: number; west: number; north: number; east: number }
  sources?: WaterQualitySourceRef[]
  incidents: WaterIncident[]
}

/** Sample site + latest observation joined for future map / SpotDetail layers */
export interface WaterQualitySiteMarker extends WaterSampleSite {
  status: WaterQualityStatus
  labelUk: string | null
  sampledAt: string | null
  metricsNoteUk?: string | null
  confidence?: WaterQualityConfidence | null
  sourceUrls: string[]
  authority?: string | null
}

/** River local width fusion (`public/data/river-widths.json`) */
export type RiverWidthMethod =
  | 'field'
  | 'osm_polygon'
  | 'swot_sword'
  | 'grwl_rivwidth'
  | 'merit_wth'
  | 'osm_width_tag'
  | 'unknown'

export type RiverWidthClass = 'narrow' | 'medium' | 'wide' | 'unknown'

export type RiverWidthConfidence = 'high' | 'medium' | 'low' | 'none'

export interface RiverWidthAlternate {
  method: RiverWidthMethod
  widthM: number
  confidence: RiverWidthConfidence
}

export interface RiverWidthOsmEntry {
  widthM: number | null
  widthClass: RiverWidthClass
  method: RiverWidthMethod
  confidence: RiverWidthConfidence
  nSamples?: number | null
  sourceNoteUk?: string | null
  alternates?: RiverWidthAlternate[]
}

export interface RiverWidthSample {
  methodId: RiverWidthMethod
  lat: number
  lng: number
  widthM: number
  confidence?: RiverWidthConfidence
  riverUk?: string | null
  reachId?: string | null
  nodeId?: string | null
  osmId?: string | null
  id?: string
  noteUk?: string | null
}

export interface RiverWidthSourceRef {
  id: RiverWidthMethod
  priority: number
  nameUk: string
  role: string
  noteUk?: string
  status?: string
}

export interface RiverWidthsDoc {
  schemaVersion: number
  updatedAt: string
  fetchedAt: string | null
  bbox: { south: number; west: number; north: number; east: number }
  sources: RiverWidthSourceRef[]
  byOsmId: Record<string, RiverWidthOsmEntry>
  samples: RiverWidthSample[]
}
