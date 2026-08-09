import type { RestrictionLevel, PaddleVerdict, WaterQualityStatus, WaterIncidentSeverity } from '../types'

export const RESTRICTION_COLORS: Record<RestrictionLevel, string> = {
  banned_navigation: '#c0392b',
  oblast_ban: '#d35400',
  restricted: '#e67e22',
  check_local: '#27ae60',
  likely_ok: '#1e8449',
}

export const RESTRICTION_LABELS: Record<RestrictionLevel, string> = {
  banned_navigation: 'Виходити на воду заборонено',
  oblast_ban: 'Обласна заборона',
  restricted: 'Є заборона від громади',
  check_local: 'Перевірте правила на місці',
  likely_ok: 'Немає відомої заборони громади',
}

/** Colors for map mode «де поплавати» */
export const PADDLE_COLORS: Record<PaddleVerdict, string> = {
  ok: '#2980b9',
  negative: '#95a5a6',
}

export const PADDLE_LABELS: Record<PaddleVerdict, string> = {
  ok: 'Люди тут плавають (є свіжі згадки)',
  negative: 'Свіжі відгуки: сплав проблемний',
}

/** Detail mode river stroke (flat blue, no gradient; WCAG 3:1 on Carto Light). */
export const DETAIL_RIVER_SWATCH = '#0f5a94'

/**
 * Lab / bathing samples — cool greens (circles on map).
 * Deliberately avoid orange/red used historically for incidents.
 */
export const WATER_QUALITY_COLORS: Record<WaterQualityStatus, string> = {
  ok: '#1b7f5a',
  advisory: '#5c6bc0',
  unsafe: '#37474f',
  unknown: '#90a4ae',
}

export const WATER_QUALITY_LABELS: Record<WaterQualityStatus, string> = {
  ok: 'Проба: норма',
  advisory: 'Проба: є зауваження',
  unsafe: 'Проба: купатися не рекомендовано',
  unknown: 'Немає свіжої проби',
}

/** Incidents — warm purple/magenta diamonds (not lab greens). */
export const INCIDENT_COLORS: Record<WaterIncidentSeverity, string> = {
  low: '#7e57c2',
  medium: '#6a1b9a',
  high: '#4a148c',
  critical: '#311b92',
}

/** Dark earth tones for dams / weirs / culverts (no bright orange). */
export const HAZARD_COLORS = {
  stroke: '#2c211c',
  major: '#3e2723',
  minor: '#5d4037',
} as const

export const INCIDENT_STATUS_LABELS: Record<string, string> = {
  active: 'Активний',
  monitoring: 'Моніторинг',
  resolved: 'Закритий',
}

export const HAZARD_KIND_LABELS: Record<string, string> = {
  dam: 'Дамба',
  weir: 'Гребля / перелив',
  waterfall: 'Водоспад',
  lock: 'Шлюз',
  sluice: 'Затвор',
  rapids: 'Перекати',
  culvert: 'Колектор / водопропуск',
  drain: 'Дренажний канал',
  ditch: 'Канава',
  wastewater: 'Стоки / очисні',
  other: 'Перешкода',
}

export const KIND_LABELS: Record<string, string> = {
  lake: 'озеро',
  river: 'річка',
  river_bay: 'річкова затока',
  river_channels: 'протоки',
  reservoir: 'водосховище',
  pond: 'ставок',
  quarry: 'карʼєр',
  oxbow: 'стариця',
  basin: 'котлован',
  bay: 'затока',
  channel: 'канал / протока',
  other: 'водойма',
}

export const PADDLE_SUITABILITY_LABELS: Record<string, string> = {
  excellent: 'відмінно',
  excellent_when_allowed: 'відмінно, коли дозволено',
  good: 'добре',
  good_when_allowed: 'добре, коли дозволено',
  moderate: 'помірно',
  moderate_when_allowed: 'помірно, коли дозволено',
  poor: 'погано / не рекомендується',
}

export const SWIM_SUITABILITY_LABELS: Record<string, string> = {
  good: 'добре',
  moderate: 'помірно',
  poor: 'погано',
  variable: 'мінливо',
}

export const AMENITY_LABELS: Record<string, string> = {
  beach: 'пляж',
  local_beach: 'місцевий пляж',
  rental_sup: 'прокат SUP',
  showers: 'душові',
  cafes: 'кафе',
  lifeguard_seasonal: 'рятувальники (сезон)',
  metro_nearby: 'метро поруч',
  forest: 'ліс',
  nature: 'природа',
  park: 'парк',
  islands_nearby: 'острови поруч',
  pedestrian_bridge: 'пішохідний міст',
  shore: 'берег',
  shore_views: 'краєвиди з берега',
  scenic: 'мальовниче місце',
  waterfront: 'набережна',
  quarry: 'карʼєр',
  local: 'місцеве місце',
}

const REGION_LABELS: Record<string, string> = {
  'Kyiv city': 'м. Київ',
  'Kyiv city south': 'м. Київ (південь)',
  'Kyiv city / adjacent': 'м. Київ / околиці',
  'Kyiv city / oblast': 'м. Київ / область',
  'Kyiv city / Obukhivskyi': 'м. Київ / Обухівський',
  'Kyiv oblast': 'Київська область',
  'Kyiv oblast (south)': 'Київська область (південь)',
  'Kyiv / adjacent': 'Київ / околиці',
  'Kyiv / Bucha direction': 'Київ / напрямок Бучі',
  'Kyiv / Cherkasy oblast adjacent': 'Київ / суміжно з Черкаською обл.',
  'Kyiv / Zhytomyr adjacent': 'Київ / суміжно з Житомирською обл.',
  'Boryspilskyi / east oblast': 'Бориспільський / схід області',
  Obukhivskyi: 'Обухівський',
  'Obukhivskyi / Kozyn': 'Обухівський / Козин',
  Vyshhorod: 'Вишгород',
  'Kyiv oblast / OSM': 'Київська область · OSM',
  'Kyiv oblast / classified': 'Київська область · класифікація',
  'Kyiv oblast / paddle reports ≥2023': 'Київська область · звіти з 2023',
}

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] || kind
}

export function regionLabel(region: string): string {
  if (REGION_LABELS[region]) return REGION_LABELS[region]
  if (/[а-яіїєґА-ЯІЇЄҐ]/.test(region)) return region
  return region
    .replace(/Kyiv city/gi, 'м. Київ')
    .replace(/Kyiv oblast/gi, 'Київська область')
    .replace(/\bKyiv\b/gi, 'Київ')
    .replace(/Cherkasy/gi, 'Черкаська')
    .replace(/Zhytomyr/gi, 'Житомирська')
    .replace(/Obukhivskyi/gi, 'Обухівський')
    .replace(/Bucha/gi, 'Буча')
    .replace(/Boryspilskyi/gi, 'Бориспільський')
    .replace(/Vyshhorod/gi, 'Вишгород')
    .replace(/adjacent/gi, 'околиці')
    .replace(/oblast/gi, 'область')
}

export function paddleSuitabilityLabel(value: string): string {
  return PADDLE_SUITABILITY_LABELS[value] || value.replaceAll('_', ' ')
}

export function swimSuitabilityLabel(value: string): string {
  return SWIM_SUITABILITY_LABELS[value] || value.replaceAll('_', ' ')
}

export function amenityLabel(value: string): string {
  return AMENITY_LABELS[value] || value.replaceAll('_', ' ')
}

export function loadDots(grade: number): string {
  return '●'.repeat(grade) + '○'.repeat(Math.max(0, 5 - grade))
}

/** Normalize Ukrainian/typographic apostrophes so «Карʼєр» matches «Кар'єр». */
function normalizeSearchText(s: string): string {
  return s.toLowerCase().replace(/[`'ʼ’ʻ´]/g, "'")
}

export function fitsSearch(text: string, q: string): boolean {
  if (!q.trim()) return true
  return normalizeSearchText(text).includes(normalizeSearchText(q.trim()))
}
