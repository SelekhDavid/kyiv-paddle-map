/**
 * Fetch hydropost water levels from hydro-ua.com (mirror of УкрГМЦ / meteo.gov.ua),
 * filter to the map extent, write a live-ready snapshot.
 *
 * Output: public/data/hydro-posts.json
 * Run: npm run fetch-hydro-posts
 *
 * Schema: stations[] (catalog-ish) + observations{} (levels by station id).
 * See docs/methodology-hydro-posts.md
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'public', 'data')
const OUT = join(DATA, 'hydro-posts.json')

/** Match operational map extent (see src/lib/mapExtent.ts) */
const MAP_EXTENT = {
  south: 49.85,
  west: 29.2,
  north: 51.28,
  east: 32.3,
}

/** Soft pad for priority rivers slightly outside the cut (e.g. northern Desna). */
const PRIORITY_PAD = 0.35

/**
 * Plan §3 priority rivers (УкрГМЦ binding targets).
 * Normalize: lower-case, strip punctuation, ё→е, і/ї variants kept.
 */
const PRIORITY_RIVERS = [
  'десна',
  'тетерів',
  'тетеров',
  'рось',
  'ірпінь',
  'ирпень',
  'стугна',
  'трубіж',
  'трубеж',
  'здвиж',
  'дніпро',
  'днепр',
]

const ENDPOINTS = {
  daily: 'https://hydro-ua.com/api/hydroday.json',
  auto: 'https://hydro-ua.com/api/hydroauto.json',
}

const SOURCE_UI = {
  daily: 'https://www.meteo.gov.ua/ua/Faktichni-sposterezhennya-merezhi-hidrolohichnikh-postiv',
  auto: 'https://www.meteo.gov.ua/ua/Dani-avtomatichnikh-hidrolohichnikh-postiv',
}

const UA = 'kyiv-paddle-map/1.1 (hydro-posts fetch; +380 research map)'

function inExtent(lat, lng, pad = 0) {
  return (
    lat >= MAP_EXTENT.south - pad &&
    lat <= MAP_EXTENT.north + pad &&
    lng >= MAP_EXTENT.west - pad &&
    lng <= MAP_EXTENT.east + pad
  )
}

function normRiver(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[''`ʼ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function isPriorityRiver(riverUk) {
  const n = normRiver(riverUk)
  if (!n) return false
  return PRIORITY_RIVERS.some((p) => n === p || n.includes(p) || p.includes(n))
}

function keepStation(lat, lng, riverUk) {
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) {
    return false
  }
  if (inExtent(lat, lng, 0)) return true
  if (isPriorityRiver(riverUk) && inExtent(lat, lng, PRIORITY_PAD)) return true
  return false
}

/**
 * Parse source timestamps:
 * - daily: "08.08.2026"
 * - auto:  "08.08.2026, 22:00" or "08.08.2026, 23:00"
 * Assume Europe/Kyiv local wall clock → emit ISO with +03:00 (EEST) or +02:00 (EET).
 * Simple: use +03:00 in summer months (Mar–Oct) as good-enough for paddle map;
 * winter Nov–Feb → +02:00. Not a full TZ library — documented caveat.
 */
function parseSourceTime(raw) {
  if (!raw || typeof raw !== 'string') return null
  const m = raw.trim().match(
    /^(\d{2})\.(\d{2})\.(\d{4})(?:\s*,\s*(\d{1,2}):(\d{2}))?$/,
  )
  if (!m) return null
  const [, dd, mm, yyyy, hh = '12', min = '00'] = m
  const month = Number(mm)
  const offset = month >= 3 && month <= 10 ? '+03:00' : '+02:00'
  const isoLocal = `${yyyy}-${mm}-${dd}T${String(hh).padStart(2, '0')}:${min}:00${offset}`
  const t = Date.parse(isoLocal)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString()
}

function toCmChange(changePerDayM) {
  if (changePerDayM == null || Number.isNaN(Number(changePerDayM))) return null
  return Math.round(Number(changePerDayM) * 100)
}

async function fetchJson(url, label) {
  console.log(`[${label}] GET ${url}`)
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': UA,
    },
  })
  if (!res.ok) {
    throw new Error(`${label}: HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
  return res.json()
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) return payload.data
    return Object.values(payload)
  }
  return []
}

/**
 * @param {'daily'|'auto'} kind
 * @param {object} row
 */
function normalizeRow(kind, row) {
  const id = String(row.id ?? '').trim()
  if (!id) return null
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  const nameUk = String(row.post || '').trim() || `Пост ${id}`
  const riverUk = String(row.river || '').trim() || null
  const basinUk = row.basin ? String(row.basin).trim() : null
  const levelCm =
    row.water_level_cm != null && !Number.isNaN(Number(row.water_level_cm))
      ? Number(row.water_level_cm)
      : null
  const rawTime = kind === 'auto' ? row.datetime : row.date
  const observedAt = parseSourceTime(rawTime)
  const tempC =
    row.water_temp_c != null && !Number.isNaN(Number(row.water_temp_c))
      ? Number(row.water_temp_c)
      : null
  const changeCm = kind === 'daily' ? toCmChange(row.change_per_day_m) : null
  const balticSystemM =
    row.baltic_system_m != null && !Number.isNaN(Number(row.baltic_system_m))
      ? Number(row.baltic_system_m)
      : null

  return {
    id,
    nameUk,
    riverUk,
    basinUk,
    lat,
    lng,
    kind,
    levelCm,
    observedAt,
    tempC,
    changeCm,
    balticSystemM,
    sourceUrl: SOURCE_UI[kind],
  }
}

/**
 * Prefer auto over daily when same id (fresher datetime).
 * Merge fields: keep daily temp/change if auto lacks them.
 */
function mergePreferAuto(existing, incoming) {
  if (!existing) return incoming
  const prefer = incoming.kind === 'auto' ? incoming : existing
  const other = incoming.kind === 'auto' ? existing : incoming
  const kinds = new Set([existing.kind, incoming.kind])
  return {
    ...prefer,
    // Union of presence in feeds
    kind: kinds.has('auto') && kinds.has('daily') ? 'auto' : prefer.kind,
    feedKinds: [...kinds].sort(),
    tempC: prefer.tempC ?? other.tempC,
    changeCm: prefer.changeCm ?? other.changeCm,
    balticSystemM: prefer.balticSystemM ?? other.balticSystemM,
    basinUk: prefer.basinUk || other.basinUk,
    riverUk: prefer.riverUk || other.riverUk,
    nameUk: prefer.nameUk || other.nameUk,
    // Keep the richer / auto observedAt; if both, prefer auto's
    observedAt:
      prefer.kind === 'auto'
        ? prefer.observedAt || other.observedAt
        : other.kind === 'auto'
          ? other.observedAt || prefer.observedAt
          : prefer.observedAt || other.observedAt,
    sourceUrl: prefer.kind === 'auto' ? SOURCE_UI.auto : prefer.sourceUrl || other.sourceUrl,
  }
}

async function main() {
  const fetchedAt = new Date().toISOString()
  const [dailyRaw, autoRaw] = await Promise.all([
    fetchJson(ENDPOINTS.daily, 'hydroday'),
    fetchJson(ENDPOINTS.auto, 'hydroauto'),
  ])

  const daily = asArray(dailyRaw).map((r) => normalizeRow('daily', r)).filter(Boolean)
  const auto = asArray(autoRaw).map((r) => normalizeRow('auto', r)).filter(Boolean)
  console.log(`Raw: daily=${daily.length}, auto=${auto.length}`)

  /** @type {Map<string, any>} */
  const byId = new Map()
  for (const row of [...daily, ...auto]) {
    if (!keepStation(row.lat, row.lng, row.riverUk)) continue
    byId.set(row.id, mergePreferAuto(byId.get(row.id), row))
  }

  const stations = []
  const observations = {}
  let kyivHit = false

  for (const row of [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, 'uk'))) {
    const feedKinds = row.feedKinds || [row.kind]
    stations.push({
      id: row.id,
      nameUk: row.nameUk,
      riverUk: row.riverUk,
      basinUk: row.basinUk,
      lat: Math.round(row.lat * 1e6) / 1e6,
      lng: Math.round(row.lng * 1e6) / 1e6,
      kind: feedKinds.includes('auto') ? 'auto' : 'daily',
      feedKinds,
      // Placeholders for later manual curation (paddlability thresholds)
      thresholdsCm: { low: null, normal: null, high: null },
      hostRiverOsmId: null,
      sourceUrl: row.sourceUrl,
      priorityRiver: isPriorityRiver(row.riverUk),
    })
    observations[row.id] = {
      levelCm: row.levelCm,
      observedAt: row.observedAt,
      tempC: row.tempC,
      changeCm: row.changeCm,
      balticSystemM: row.balticSystemM,
    }
    if (
      row.id === '80986' ||
      (normRiver(row.nameUk) === 'київ' && /дніпр/i.test(row.riverUk || ''))
    ) {
      kyivHit = true
    }
  }

  const doc = {
    schemaVersion: 1,
    updatedAt: fetchedAt,
    fetchedAt,
    source: {
      provider: 'hydro-ua',
      noteUk:
        'Дзеркало спостережень УкрГМЦ (meteo.gov.ua). Первинне джерело — Укргідрометцентр.',
      endpoints: [ENDPOINTS.daily, ENDPOINTS.auto],
      officialUi: [SOURCE_UI.daily, SOURCE_UI.auto],
    },
    bbox: { ...MAP_EXTENT },
    priorityRiversUk: [
      'Десна',
      'Тетерів',
      'Рось',
      'Ірпінь',
      'Стугна',
      'Трубіж',
      'Здвиж',
      'Дніпро',
    ],
    counts: {
      stations: stations.length,
      withLevel: stations.filter((s) => observations[s.id]?.levelCm != null).length,
      auto: stations.filter((s) => s.kind === 'auto').length,
      dailyOnly: stations.filter((s) => s.kind === 'daily').length,
      priority: stations.filter((s) => s.priorityRiver).length,
    },
    stations,
    observations,
  }

  await mkdir(DATA, { recursive: true })
  await writeFile(OUT, JSON.stringify(doc, null, 2), 'utf8')
  console.log(`Wrote ${stations.length} stations → ${OUT}`)
  console.log('counts:', doc.counts)
  console.log(kyivHit ? 'OK: Kyiv Дніпро post present' : 'WARN: Kyiv Дніпро post (80986) not in filter')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
