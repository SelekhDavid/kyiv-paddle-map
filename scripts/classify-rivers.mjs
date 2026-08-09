/**
 * Classify all river LineStrings using local-rules + spots + geography.
 * Default: likely_ok when no clear local community evidence.
 * Output: public/data/classification.json
 *
 * Run: npm run classify-rivers
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA = join(ROOT, 'public', 'data')
const OUT = join(DATA, 'classification.json')

function nameToken(raw) {
  if (!raw) return ''
  return (
    String(raw)
      .toLowerCase()
      .replace(/[^a-zа-яёіїєґ\s-]/gi, ' ')
      .split(/\s+/)
      .find((t) => t.length >= 4 && !/^(річка|река|озеро|канал|водосховище)$/.test(t)) || ''
  )
}

function inBBox(lat, lng, b) {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east
}

function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function isCascadeName(name) {
  return /дніпр|днепр|водосховищ|канівськ|київськ.*вдсх|галерна|гідропарк|труханів|венец/i.test(
    name || '',
  )
}

async function main() {
  const shapes = JSON.parse(await readFile(join(DATA, 'water-shapes.geojson'), 'utf8'))
  const spots = JSON.parse(await readFile(join(DATA, 'spots.json'), 'utf8'))
  let meta = { checkedAt: new Date().toISOString().slice(0, 10), derivedRules: [], sources: [] }
  try {
    meta = JSON.parse(await readFile(join(DATA, 'classification-meta.json'), 'utf8'))
  } catch {
    console.warn('No classification-meta.json — continuing without scrape meta')
  }

  let local = { byCommunity: {}, byRiverNameToken: {}, bySpotId: {}, checkedAt: meta.checkedAt }
  try {
    local = JSON.parse(await readFile(join(DATA, 'local-rules.json'), 'utf8'))
  } catch {
    console.warn('No local-rules.json — defaulting unnamed rivers to likely_ok')
  }

  const riverSpots = spots.filter((s) => /river|bay|channel/i.test(s.kind))
  const communities = Object.entries(local.byCommunity || {})
  const tokenRules = local.byRiverNameToken || {}

  const features = {}
  const counts = {
    banned_navigation: 0,
    oblast_ban: 0,
    restricted: 0,
    check_local: 0,
    likely_ok: 0,
  }

  for (const f of shapes.features || []) {
    if (f.geometry?.type !== 'LineString' || f.properties?.kind !== 'river') continue
    const p = f.properties
    const osmId = p.osmId
    const lat = p.lat
    const lng = p.lng
    const fullName = `${p.nameUk || ''} ${p.name || ''} ${p.nameEn || ''}`
    const token = nameToken(fullName)

    let level = null
    let reasonUk = ''
    let sourceIds = []

    // Priority 1: curated river spot — name token alone must NOT paint an entire
    // named river (e.g. all of Desna / Irpin). Require geographic proximity to
    // the spot; bans in sources are usually hromada-scoped.
    const SPOT_MATCH_KM = 25
    let bestSpot = null
    let bestScore = -1
    for (const s of riverSpots) {
      const hint = nameToken(s.osmHint || s.nameUk)
      const dist = haversineKm({ lat, lng }, { lat: s.lat, lng: s.lng })
      if (dist > SPOT_MATCH_KM) continue
      let score = Math.max(0, 40 - dist)
      if (hint && token && hint === token) score += 100
      if (score > bestScore) {
        bestScore = score
        bestSpot = s
      }
    }
    if (bestSpot && bestScore >= 40) {
      const override = local.bySpotId?.[bestSpot.id]
      level = override?.level || bestSpot.restriction.level
      reasonUk =
        override?.evidenceUk ||
        `Привʼязка до локації «${bestSpot.nameUk}» — ${bestSpot.restriction.labelUk}`
      sourceIds = ['spot:' + bestSpot.id, ...(override?.sources || [])]
    }

    // Priority 1b: cascade / Dnipro names → red
    if (!level && isCascadeName(fullName)) {
      level = 'banned_navigation'
      reasonUk = 'Дніпро / каскад водосховищ (публічна заборона цивільної навігації)'
      sourceIds = ['cascade_dnipro']
    }

    // Priority 2: named river token — only if rule has bbox (or segment in that bbox).
    // Bare name tokens were removed: they painted entire Zdvyzh / Bucha / etc.
    if (!level && token && tokenRules[token]) {
      const rule = tokenRules[token]
      const box = rule.bbox
      if (!box || inBBox(lat, lng, box)) {
        level = rule.level
        reasonUk = rule.evidenceUk
        sourceIds = [`river:${token}`, ...(rule.sources || [])]
      }
    }

    // Priority 3: community geo zones with evidence in local-rules
    if (!level) {
      for (const [communityId, rule] of communities) {
        const box = rule.bbox
        if (box && inBBox(lat, lng, box)) {
          level = rule.level
          reasonUk = rule.evidenceUk
          sourceIds = [`community:${communityId}`, ...(rule.sources || [])]
          break
        }
      }
    }

    // Default: no clear local ban → green
    if (!level) {
      level = 'likely_ok'
      reasonUk =
        'Чіткої локальної заборони громади/НП для цього сегмента не знайдено. Колір кодує локальну конкретику; загальна заборона КОДА на навігацію може формально стосуватися області.'
      sourceIds = ['local-rules:default_likely_ok']
    }

    features[osmId] = {
      level,
      reasonUk,
      sourceIds,
      name: p.nameUk || p.name || null,
      lat,
      lng,
    }
    counts[level] = (counts[level] || 0) + 1
  }

  const checkedAt = local.checkedAt || meta.checkedAt || new Date().toISOString().slice(0, 10)
  const doc = {
    checkedAt,
    generatedAt: new Date().toISOString(),
    method: 'local-rules+spots+cascade',
    metaCheckedAt: meta.checkedAt || null,
    counts,
    features,
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(doc), 'utf8')
  console.log(`Classified ${Object.keys(features).length} rivers → ${OUT}`)
  console.log('Counts:', counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
