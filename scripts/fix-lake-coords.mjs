/**
 * One-shot: pin curated standing waters to correct OSM polygons + centroids.
 * Run: node scripts/fix-lake-coords.mjs
 */
import fs from 'fs'

const path = 'public/data/spots.json'
const shapes = JSON.parse(fs.readFileSync('public/data/water-shapes.geojson', 'utf8')).features
const byOsm = new Map(shapes.map((f) => [f.properties.osmId, f]))

/** @type {Record<string, { osmIds: string[], nameUk?: string, region?: string, osmHint?: string, accessUk?: string, tipsUk?: string, notesPatch?: string }>} */
const FIXES = {
  telbin: { osmIds: ['way/6141739'] },
  vyrlytsia: { osmIds: ['way/28237004'], osmHint: 'Вирлиця' },
  // Popular «Сонячне» is Pozniaky / Darnytskyi, not Troeschina
  sonyachne: {
    osmIds: ['relation/11601776'],
    nameUk: 'Сонячне озеро (Позняки)',
    region: 'Kyiv city / Pozniaky',
    osmHint: 'Сонячне',
    accessUk: 'м. Харківська / Позняки',
    tipsUk: 'Не плутати з водоймами Троєщини; OSM — Сонячне біля Харківського масиву.',
  },
  'kyivske-vdskh': { osmIds: ['relation/1605938'], osmHint: 'Київське водосховище' },
  'kanivske-vdskh': {
    // Northern reach representation (spot title); full relation kept for contours
    osmIds: ['way/183166149', 'relation/3173129'],
    osmHint: 'Канівське',
  },
  berkovetske: {
    osmIds: ['way/31165311'],
    nameUk: 'Синє озеро (Берковець)',
    osmHint: 'Синє',
    region: 'Kyiv / Berkovets',
    accessUk: 'Берковець / вул. Синьоозерна',
    tipsUk: 'Водойма зони відпочинку Берковець (Синє); не плутати з безіменними ставками біля Коцюбинського.',
  },
  radunka: {
    osmIds: ['way/8072297'],
    osmHint: 'Радунка',
    region: 'Kyiv city / left bank',
    accessUk: 'Русанівка / лівий берег (Райдужне / Радунка)',
    tipsUk: 'OSM: Райдужне озеро (Радунка). Не плутати з Китаївськими ставками.',
  },
  typete: { osmIds: ['relation/2002308'], osmHint: 'Тягле' },
  nedozadne: {
    osmIds: ['way/56684319'],
    nameUk: 'Озеро Заплавне (Бортничі)',
    osmHint: 'Заплавне',
    region: 'Kyiv city / Bortnychi',
    accessUk: 'Бортничі / Дарницький р-н',
    tipsUk: 'Ландшафтний заказник «Озеро Заплавне». Колишня мітка «Неводницьке» була з помилковими координатами.',
  },
  sobachne: {
    osmIds: ['relation/17502706'],
    nameUk: 'Вербне озеро (Оболонь)',
    osmHint: 'Вербне',
    accessUk: 'Оболонь / вул. Приозерна',
    tipsUk: 'Популярна водойма Оболоні (Вербне). Затока «Собаче гирло» — окремий об’єкт.',
  },
  almazne: { osmIds: ['way/5218569'], osmHint: 'Алмазне' },
  basaika: {
    osmIds: ['relation/1773963', 'relation/9967245'],
    osmHint: 'Паладинські',
  },
  'kozyn-quarry': {
    osmIds: ['way/174764307', 'way/174764309'],
    osmHint: 'Козинка',
  },
  // blakytne / redkyne already explicit
}

const spots = JSON.parse(fs.readFileSync(path, 'utf8'))
const report = []

for (const s of spots) {
  const fix = FIXES[s.id]
  if (!fix) continue
  const props = []
  for (const id of fix.osmIds) {
    const f = byOsm.get(id)
    if (!f) {
      report.push(`${s.id}: MISSING ${id}`)
      continue
    }
    props.push(f.properties)
  }
  if (!props.length) continue
  let lat = props[0].lat
  let lng = props[0].lng
  // Multi-poly groups (cascades): average only when all members are near the primary
  if (props.length > 1) {
    const primary = { lat, lng }
    const near = props.filter((p) => {
      const dLat = (p.lat - primary.lat) * 111
      const dLng = (p.lng - primary.lng) * 111 * Math.cos((primary.lat * Math.PI) / 180)
      return Math.hypot(dLat, dLng) < 8
    })
    if (near.length > 1) {
      lat = near.reduce((s, p) => s + p.lat, 0) / near.length
      lng = near.reduce((s, p) => s + p.lng, 0) / near.length
    }
  }
  s.lat = +lat.toFixed(6)
  s.lng = +lng.toFixed(6)
  s.matchedOsmId = fix.osmIds[0]
  s.matchedOsmIds = fix.osmIds
  if (fix.nameUk) s.nameUk = fix.nameUk
  if (fix.region) s.region = fix.region
  if (fix.osmHint) s.osmHint = fix.osmHint
  if (fix.accessUk) s.accessUk = fix.accessUk
  if (fix.tipsUk) s.tipsUk = fix.tipsUk
  report.push(
    `${s.id}: ${s.lat},${s.lng} ← ${props.map((p) => `${p.osmId}(${p.name || p.nameUk})`).join('; ')}`,
  )
}

fs.writeFileSync(path, JSON.stringify(spots, null, 2) + '\n', 'utf8')
console.log(report.join('\n'))
