/**
 * Scrape public OVA/community pages for navigation / recreation ban signals.
 * Output: public/data/classification-meta.json
 *
 * Run: npm run scrape-bans
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'public', 'data', 'classification-meta.json')

const STATIC_SOURCES = [
  {
    id: 'koda-nav',
    title: 'КОДА — заборона навігації',
    url: 'https://koda.gov.ua/do-uvagy-meshkancziv-kyyivskoyi-oblasti-tryvaye-zaborona-navigacziyi-na-vodojmah-kyyivshhyny/',
  },
  {
    id: 'kotsyubynske-swim',
    title: 'Коцюбинське — купатися заборонено',
    url: 'https://kotsyubinskarada.gov.ua/news/222029-kupatis-zaboroneno',
  },
  {
    id: 'irpin-swim',
    title: 'Ірпінь — купання заборонено',
    url: 'https://imr.gov.ua/uvaga-kupannya-zaboroneno-mistsevi-vodojmy-mozhut-nesty-nebezpeku/',
  },
  {
    id: 'bilogorodka-swim',
    title: 'Білогородка — заборона відпочинку на водоймах',
    url: 'https://bilohorodka.org.ua/zaborona-na-vidpochynok-na-vodnykh-ob-iektakh-de-mozhna-kupatysia-u-kyivskij-oblasti/',
  },
  {
    id: 'boryspil-swim',
    title: 'Бориспіль — заборона купання',
    url: 'https://borispol-rada.gov.ua/item/59155-u-hromadi-diie-zaborona-na-kupannia-na-vodnykh-obiektakh.html',
  },
  {
    id: 'borodyanka-swim',
    title: 'Бородянка — купання заборонено',
    url: 'https://bsr.gov.ua/kupannya-u-vodojmah-borodyanskoyi-gromady-zaboroneno/',
  },
  {
    id: 'borshchagivka-swim',
    title: 'Борщагівка — купання заборонено',
    url: 'https://brada.gov.ua/society/kupannia-zaboroneno/',
  },
  {
    id: 'zazymya-desna',
    title: 'Зазимська громада — без Десни',
    url: 'https://zotg.gov.ua/provodymo-svoye-dozvillya-bez-desny/',
  },
  {
    id: 'kyiv-comments-bans',
    title: 'Огляд заборон у Київській області',
    url: 'https://kyiv.comments.ua/ua/news/society/human-rights/24694-u-kiivskiy-oblasti-prodovzhuyut-vvoditi-zaboroni-prichini.html',
  },
]

const SIGNAL_PATTERNS = [
  { id: 'nav_ban', re: /заборона\s+навігац|заборонено\s+навігац|запрет\s+навигац/i },
  { id: 'small_craft', re: /маломір|маломер|водн(і|ые)\s+мотоцикл|засоб(ів|и)\s+розваг/i },
  { id: 'swim_ban', re: /купатись\s+заборонено|заборонено\s+купан|запрещено\s+купа/i },
  { id: 'mass_recreation', re: /масов(ий|ого)\s+відпочинок|массовый\s+отдых|водн(ий|ый)\s+спорт/i },
  { id: 'martial_law', re: /воєнн(ого|ий)\s+стан|военн(ого|ое)\s+положен/i },
  { id: 'dnipro_cascade', re: /київськ(е|ого)\s+водосховищ|канівськ|каскад\s+дніпр|днепровск/i },
  { id: 'bucha', re: /бучанськ|коцюбинськ/i },
  { id: 'irpin', re: /ірпін|ирпен/i },
  { id: 'bilogorodka', re: /білогород|белогород/i },
  { id: 'boryspil', re: /бориспіль|бориспол/i },
  { id: 'baryshivka', re: /баришівк/i },
]

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function loadExtraUrls() {
  const urls = []
  try {
    const rules = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'rules.json'), 'utf8'))
    for (const rule of rules.regionalRules || []) {
      for (const s of rule.sources || []) {
        if (s.url) urls.push({ id: `rules-${rule.id}`, title: s.title || rule.id, url: s.url })
      }
    }
  } catch {
    /* optional */
  }
  try {
    const spots = JSON.parse(await readFile(join(ROOT, 'public', 'data', 'spots.json'), 'utf8'))
    let n = 0
    for (const spot of spots) {
      for (const url of spot.restriction?.sources || []) {
        if (typeof url === 'string' && url.startsWith('http') && n < 5) {
          urls.push({ id: `spot-${spot.id}-${n}`, title: spot.nameUk, url })
          n++
        }
      }
    }
  } catch {
    /* optional */
  }
  return urls
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'kyiv-paddle-map/1.2 (ban status research; local classify)',
    },
    redirect: 'follow',
  })
  const text = await res.text()
  return { status: res.status, text }
}

function detectSignals(text) {
  const hits = []
  for (const p of SIGNAL_PATTERNS) {
    if (p.re.test(text)) hits.push(p.id)
  }
  return hits
}

function deriveRules(sources) {
  const all = new Set(sources.flatMap((s) => s.signals || []))
  const communities = []
  if (all.has('bucha')) communities.push('bucha')
  if (all.has('irpin')) communities.push('irpin')
  if (all.has('bilogorodka')) communities.push('bilogorodka')
  if (all.has('boryspil')) communities.push('boryspil')
  if (all.has('baryshivka')) communities.push('baryshivka')

  return [
    {
      id: 'oblast_navigation_ban',
      active: all.has('nav_ban') || all.has('small_craft'),
      level: null,
      noteUk:
        'Контекст: загальна заборона цивільної навігації КОДА. Не фарбує карту жовтим само по собі — див. local-rules.json.',
    },
    {
      id: 'cascade_dnipro',
      active: all.has('dnipro_cascade') || all.has('nav_ban'),
      level: 'banned_navigation',
      noteUk: 'Каскад Дніпра / водосховища — повна заборона цивільного виходу.',
    },
    {
      id: 'community_mass_recreation',
      active: all.has('swim_ban') || all.has('mass_recreation') || communities.length > 0,
      level: 'restricted',
      communities,
      noteUk:
        'Сигнали місцевих заборон масового відпочинку (еvidence застосовується лише через local-rules.json).',
    },
    {
      id: 'martial_law_context',
      active: all.has('martial_law'),
      level: null,
      noteUk: 'Контекст воєнного стану у джерелах.',
    },
  ]
}

async function main() {
  const extras = await loadExtraUrls()
  const byUrl = new Map()
  for (const s of [...STATIC_SOURCES, ...extras]) {
    if (!byUrl.has(s.url)) byUrl.set(s.url, s)
  }
  const list = [...byUrl.values()]
  console.log(`Scraping ${list.length} sources…`)

  const results = []
  for (const src of list) {
    process.stdout.write(`  ${src.id}… `)
    try {
      const { status, text } = await fetchText(src.url)
      const plain = stripHtml(text).slice(0, 200_000)
      const signals = detectSignals(plain)
      console.log(`HTTP ${status}; signals=[${signals.join(',')}]`)
      results.push({
        id: src.id,
        title: src.title,
        url: src.url,
        fetchedAt: new Date().toISOString(),
        httpStatus: status,
        signals,
        ok: status >= 200 && status < 400,
      })
    } catch (e) {
      console.log(`FAIL ${e.message}`)
      results.push({
        id: src.id,
        title: src.title,
        url: src.url,
        fetchedAt: new Date().toISOString(),
        httpStatus: 0,
        signals: [],
        ok: false,
        error: String(e.message || e),
      })
    }
  }

  const checkedAt = new Date().toISOString().slice(0, 10)
  const meta = {
    checkedAt,
    generatedAt: new Date().toISOString(),
    method: 'live_scrape',
    sources: results,
    derivedRules: deriveRules(results),
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(meta, null, 2), 'utf8')
  console.log(`Wrote ${OUT} (checkedAt=${checkedAt})`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
