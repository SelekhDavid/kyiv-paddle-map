# Water incidents / pollution / bloom sources (Kyiv + Kyiv oblast)

`checkedAt`: **2026-08-09**  
Scope: public sources usable later for paddle/swim map overlays (`incidents[]` → `waterQuality` layer). **No map UI in this research.**

Companion machine-readable examples: [`water-incidents.json`](water-incidents.json).

---

## Executive verdict

| Need | Best first-class source | Live poll later? |
|------|-------------------------|------------------|
| Acute spill / emergency response | ДСНС (city + oblast sites + Telegram) | Partial — HTML/Telegram, not incident API |
| Lab-confirmed sewage / fish-kill / GDC | ДЕІ Столичного округу posts | Partial — scrape HTML posts |
| River chemistry at fixed posts | Держводагентство + data.gov.ua CSV + ЕкоЗагроза map | **Yes** for posts; monthly CSV lag; map more current |
| Beach / swim suitability | КП «Плесо» + Київський ЦКПХ | Partial — weekly news HTML |
| Transboundary / basin crisis (Десна) | Міндовкілля crisis pages + MEPR digests | Manual curation during events |
| Citizen rumor lead | Local media / Telegram + ЕкоЗагроза “Повідомити” | Feed as `unconfirmed` only |

**Air tools (SaveEcoBot, EcoCity) are poor primary water-incident sources** — useful for odour/smoke context after fires/attacks, not for bloom / sewage / fish kills.

---

## 1. ДСНС / city emergency — water-related

### Official sites

| Source | URL | Structure | Trust |
|--------|-----|-----------|--------|
| ГУ ДСНС у м. Києві | https://kyiv.dsns.gov.ua/ | News HTML; categories «Надзвичайні події»; no public GeoJSON of water incidents | **Official** |
| ГУ ДСНС Київщини | https://kv.dsns.gov.ua/ | Same pattern for oblast | **Official** |
| ДСНС України (нац.) | https://dsns.gov.ua/ | National digests; water spills when large (Кирилівське) | **Official** |

### Telegram (official)

| Channel | URL | Notes |
|---------|-----|--------|
| ДСНС України | https://t.me/dsns_telegram | High signal for large water-pollution ops (нафтопродукти, бонові загородження) |
| ДСНС Київщини | https://t.me/dsns_kyiv_region | Oblast ops; mostly fires/attacks, water when relevant |
| City Kyiv GU | Prefer **kyiv.dsns.gov.ua** news; dedicated city Telegram less consistent than national+oblast pair |

### What appears about water bodies

- **Major spills only** (example: oil products into **оз. Кирилівське**, July–Aug 2026 — continuous updates on volume, boom length, containment vs Дніпро).
- Seasonal warnings (ice, drowning), not cyanobacteria bloom dashboards.
- **No structured API** of “open water incidents by lat/lng.”

### Kyiv “beach / navigation” emergency layer (adjacent, not ДСНС alone)

Wartime **Рада оборони м. Києва** protocols + ТЕБ і НС commission: recreational beach visits “not recommended,” navigation bans on many craft — already partly reflected in map classification. Treat as **policy**, separate from water-chemistry incidents.

**Polling feasibility:** scrape `/news/` RSS-like lists or Telegram via public `t.me/s/…` HTML; keyword filters (`озеро`, `нафтопродукт`, `забруднення`, `річка`, `скид`). Expect high noise from air-raid aftermath fires. Confidence: medium; always attach `sourceUrl`.

---

## 2. Media aggregators & Telegram (spills, fish kills, blooms, sewage)

### Reliable / secondary-confirm channels

| Source | URL / handle | Role | Trust |
|--------|--------------|------|--------|
| SaveDnipro еко-новини | https://t.me/savednipro · https://www.savednipro.org/ | Aggregates eco news; points to SaveEcoBot complaints | **NGO — generally reliable**, still secondary to DEI/ДСНС |
| Портал Києва (КМДА) | https://kyivcity.gov.ua/news/ | Official city restatements of Плесо / DEI / Департамент довкілля | **Official relay** |
| DW / Радіо Свобода / УНІАН / Інформатор Київ | case-by-case | Good narrative + timelines for Десна 2024, blooms | **Media** — verify coords against official |
| Local: THEBUCHACITY, Київ.info | e.g. Bucha sewage stories | Fast local pick-up of DEI posts | **Media** |

### Rumor / use-with-caution

| Source type | Examples | Policy for map |
|-------------|----------|----------------|
| Neighborhood Facebook / Discord “smells like sewage” | Тельбін, RiverStone quay bloom posts | `status: rumored`, never alone flips to `unsafe` |
| Anonymous Telegram dumps of dead fish photos | — | Lead for DEI/Плесо check only |
| Viral “аміак / хімія в Дніпрі” after missile strike | often air-side (SaveEcoBot AQI spikes) | Tag `air` context; prove water link separately |

### Telegram / community tools for *reporting*, not truth tables

- **SaveEcoBot chatbot** (Telegram / Viber / Messenger): complaint templates for water pollution → feeds SaveDnipro / inspectors; **not** a live map of verified open incidents. https://www.savednipro.org/bot/
- **ЕкоЗагроза «Повідомити»**: authenticated citizen geo-reports (water category); official routing to DEI. https://ecozagroza.gov.ua — public map of *all* citizen claims not a clean open feed.

**Polling feasibility:** Telegram channels = scrape/export + NLP tags. Media sites = HTML. Accept delay hours–days; prefer sources that cite DEI sample IDs or coordinates.

---

## 3. Держекоінспекція (Столичний округ + national)

| Source | URL | Structure | Trust |
|--------|-----|-----------|--------|
| ДЕІ Столичного округу | https://stolreg.dei.gov.ua/ | Per-case **HTML posts**; often include **lat/lng**, lab GDC multipliers, legal status | **Official — primary for local sewage/oil** |
| ДЕІ України | https://www.dei.gov.ua/ | National summaries (Кирилівське oversight) | **Official** |

### Data shape (observed)

Typical post pattern:

- Title + emoji severity flag  
- Narrative: inspection date, coordinates, discharge path into named water body  
- Lab block: NH₄⁺, phosphates, O₂, COD vs GDC  
- Status: samples taken → police/prosecutor referral → “monitoring continues”  
- **Not** a closed lifecycle API (`opened`/`mitigated`/`closed` often inferable only from follow-up posts)

Example coords in posts: р. Буча sewage well `50.5375262, 30.2312418` (Mar 2026). Separate posts cover **р. Сіверка** (Вишнева / Крюківщина) and **р. Рось** / oil-products near Біла Церква (watch for coordinate typos in HTML — verify).

**Polling feasibility:** **Medium.** Index `/post/{n}` or news listing; extract coords via regex; map to nearest spot/river token. No stable JSON API discovered. Rate-limit politely; store raw HTML hash.

---

## 4. Community / open environmental tools

| Tool | URL | Useful for water incidents? | Structure |
|------|-----|----------------------------|-----------|
| **SaveEcoBot** | https://www.saveecobot.com/ | Air, radiation, fires, permits (incl. special water use in bot); **not** bloom map | Station/city JSON URLs + radiation API (key); **no water-incident layer** |
| **EcoCity** | https://eco-city.org.ua · archive https://archive.eco-city.org.ua/ | Community **air** sensors; CSV researcher cabinet | Air timeseries; war-chemical/radiation sensors — **air, not water** |
| **ЕкоЗагроза** | https://ecozagroza.gov.ua | Official threat map + citizen reports + **surface-water monitoring map** (ДАВР API feed) | App + web; monitoring layer structured; citizen reports gated |
| **ДАВР monitoring portal** | http://monitoring.davr.gov.ua/ · GDK map http://monitoring.davr.gov.ua/EcoWaterMon/GDKMap/Index | Exceedances of GDC at posts | Interactive map; login areas; **posts ≠ recreational beaches** |
| **data.gov.ua surface waters** | https://data.gov.ua/dataset/133ce38c-9533-4fb0-b146-b211299a8731 | Monthly CSV of chemistry at posts (incl. Десна Kyiv intake, Гідропарк) | **Machine-readable** — lat/lng, date, metrics; `surface-water-monitoring` |
| КП «Плесо» | https://pleso.kyiv.ua/ | Beach network, weekly water news, live **water-level** widget (Русанівська протока), cleanup digests (Кирилівське) | HTML news; level gauge structured-ish on homepage |
| Київський ЦКПХ (МОЗ) | https://kyiv.cdc.gov.ua/ | Recreational-zone lab tables by beach name | HTML news tables — best swim-lab source next to Плесо |

**Bottom line:** For paddle map **incidents**, prioritize ДЕІ + ДСНС + Плесо/ЦКПХ + DАВР posts. Use SaveEcoBot/EcoCity only as collateral for “smoke/odour after strike near shore.”

---

## 5. Historical / recurring patterns (map-relevant)

Patterns below map onto curated spots / named rivers in `spots.json` / `local-rules`.

| Pattern | Typical water bodies / spots | Season / trigger | Severity band | Sources |
|---------|------------------------------|------------------|---------------|---------|
| **Cyanobacteria “цвітіння”** | Дніпро київська ділянка, Гідропарк/Венеція, затоки зі слабкою течією | Jul–Aug heat | advisory→unsafe contact | DEI advisories; Плесо red flags; media |
| **Recreational lab fail (microbiology)** | Тельбін, Галерний, Райдуга, Троєщина, Дитячий, etc. | Beach season sampling weeks | advisory / unsafe swim | Плесо, ЦКПХ weekly tables |
| **Transboundary organic pollution plume** | Десна (Litky → Brovary intake → Kyiv Desna intake) | Late summer events (e.g. Aug–Sep **2024** Сейм→Десна) | unsafe upstream; Kyiv intake often held “within norm” | MEPR crisis page, DAVR crisis sampling |
| **War-related petroleum into lake system** | Кирилівське → Сирець → Опечень chain (near Оболонь spots) | After depot/strike hits | **critical** local; containment vs Дніпро | ДСНС, DEI, Плесо, КМДА |
| **Chronic / acute sewage into small rivers** | Буча, Сіверка, Irpin tributaries | Year-round; worse after plant failures | critical locally | DEI Столичного округу |
| **Oil products near Ros / plant outfalls** | Рось (Біла Церква) | Industrial / utility mishaps | high local | DEI posts |
| **Wartime navigation / beach policy** | Entire city Dnipro + many lakes | Martial law | policy ban, not chemistry | Рада оборони / classification layer |

**Note:** Cascaded reservoirs (Київське / Канівське) and many Dnipro spots stay **legally red** on the paddle map regardless of bloom/spill — incidents still matter for contact-water messaging where paddling is allowed (Десна, Тетерів, Рось, lakes like Тельбін/Тягле).

---

## Placeholder schema (for later `water-quality.json` / incidents)

```ts
type WaterIncident = {
  id: string
  titleUk: string
  // Prefer exact point; else areaPolygon or areaNoteUk
  lat?: number
  lng?: number
  areaNoteUk?: string
  startedAt: string       // ISO date
  endedAt?: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  kind: 'spill' | 'sewage' | 'bloom' | 'fish_kill' | 'lab_fail' | 'war_damage' | 'other'
  waterBody: string       // free text or river/spot token
  spotIds?: string[]      // optional link into spots.json
  sourceUrl: string
  sourceClass: 'official' | 'media' | 'ngo' | 'community' | 'rumor'
  status: 'active' | 'monitoring' | 'resolved' | 'unconfirmed'
  trust: 'high' | 'medium' | 'low'
  notesUk?: string
  checkedAt: string
}
```

Active incident → force related `waterQuality.status` toward `unsafe` / `advisory` per plan §9. Rumors never override official labs alone.

---

## Live polling feasibility (phase 2+)

| Feed | Feasibility | Cadence | Effort | Risk |
|------|-------------|---------|--------|------|
| data.gov.ua monitoring CSV | **High** | Monthly publish (updates observed into 2026) | Low — download + filter Kyiv oblast / Desna posts | Lag; not beach-scale |
| ЕкоЗагроза / DAVR water map | **Medium–High** if undocumented API reverse-engineered or open endpoint reused | Near sampling frequency | Medium | ToS / breakage; ecozagroza.gov.ua intermittently errors |
| stolreg.dei.gov.ua posts | **Medium** | Ad-hoc | Medium HTML scrape + NLP/geo extract | Missing `endedAt` |
| kyiv.dsns.gov.ua + Telegram | **Medium** | Event-driven | Medium keyword pipeline | Low water signal-to-noise |
| pleso.kyiv.ua + kyiv.cdc.gov.ua | **Medium** | ~weekly in season | Medium table scrape | Wartime “season not open” wording confuses UX |
| SaveEcoBot air JSON | Low for water | Minutes | Easy station JSON | Wrong domain |
| EcoCity archive CSV | Low for water | Historic | Request-based | Air only |
| Neighborhood Telegram rumors | **Low** as truth | Continuous | High moderation | Misinfo |

**Recommended stack later:** (1) curated `incidents[]` from DEI/ДСНС/Плесо (human or assisted), (2) automated DAVR post chemistry for Десна/Дніпро advisory badges, (3) seasonal ЦКПХ/Плесо beach table join by beach name → spot id, (4) rumor inbox never auto-published.

---

## Example incidents captured

See JSON for full records. Summary:

| id | Title | Severity | Status | Trust |
|----|-------|----------|--------|-------|
| `desna-seim-2024` | Органічне забруднення Сейм→Десна | high | resolved (monitoring ended as crisis) | high / official |
| `kyrylivske-oil-2026-07` | Нафтопродукти в оз. Кирилівське | critical | monitoring (repeat Aug 8) | high / official |
| `bucha-sewage-2026-03` | Неочищені стоки в р. Буча | critical | monitoring | high / official |
| `telbin-lab-fail-pattern` | Рекреаційні проби Тельбін не відповідають | medium | recurring seasonal | high / official labs |
| `dnipro-bloom-seasonal` | Цвітіння ціанобактерій Дніпро/затоки | medium | seasonal pattern | medium–high |

---

## Source class cheat-sheet

- **Official:** ДСНС, ДЕІ, Міндовкілля, ДАВР, КМДА, Плесо, ЦКПХ МОЗ, ЕкоЗагроза (as government service).  
- **NGO / structured community:** SaveDnipro / SaveEcoBot (tools + news), EcoCity (air).  
- **Media:** use for discovery + narrative; prefer backlink to official.  
- **Rumor:** social posts without lab/coords — store only as `unconfirmed` / `rumor`.

---

## Out of scope (this doc)

Map UI, auto-scrapers in `scripts/`, changes to `spots.json`. Next engineering step when ready: fold schema into plan §9 `incidents[]` inside `public/data/water-quality.json`.
