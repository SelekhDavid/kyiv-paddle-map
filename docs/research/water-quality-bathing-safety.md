# Water quality / bathing safety — Kyiv city + Kyiv oblast

`checkedAt`: **2026-08-09**  
Scope: public sources useful for `waterQuality` / incidents on the paddle map (plan §7–9). **No map UI built in this pass.**

## Verdict (short)

| Need | Best public source | Live-update feasibility |
|------|--------------------|-------------------------|
| Named Kyiv beaches pass/fail | ЦГЗ (phc.org.ua) weekly news + Київський міський ЦКПХ (kyiv.cdc.gov.ua) | **Medium** — HTML scrape of news lists; no stable API |
| Municipal beach catalogue + coords | data.kyivcity.gov.ua / ArcGIS GeoJSON | **High** — stable ArcGIS query (note: Windows-1251 payload) |
| Micro claims “all beaches OK” | КП «Плесо» via kyivcity.gov.ua press notes | **Low–medium** — prose only, no per-beach table |
| Oblast recreational samples | Aggregated into ЦГЗ briefs; oblast ЦКПХ site sparse | **Low** for Irpin/Desna/Teteriv mid-river |
| Numeric chemistry (not bathing pass/fail) | data.gov.ua surface-water monitoring + monitoring.davr.gov.ua | **High** for DAWR stations; **not** bathing status |
| Special episodes (Desna/Seim 2024) | mepr.gov.ua / davr.gov.ua | **Event-driven** → `incidents[]` |

Important context for 2026: **official купальний сезон not opened** in Kyiv or Kyiv oblast (martial law / local TEB decisions). Labs still sample; “ok” ≠ “officially allowed season”.

---

## 1. МОЗ / ЦГЗ (national bathing briefs)

### What exists
Центр громадського здоров’я (МОЗ) publishes **seasonal weekly HTML briefs** listing regions + named beaches as “безпечна / не відповідає / проби не брали”. Microbiological criteria historically reference **індекс ЛКП** (lactose-positive coliforms), with note that **норма ЛКП = 5000** (older 2024 briefs). Per-beach numeric E.coli / coliform counts are **usually not published** in the weekly digests — only pass/fail narrative.

### Concrete URLs
| URL | Role | Scrape / subscribe |
|-----|------|--------------------|
| https://phc.org.ua/news/yakist-vodi-na-plyazhakh-ukraini-stanom-na-6-serpnya-de-bezpechno-kupatisya | **2026-08-06** national brief (Kyiv + oblast sections) | HTML; title pattern `Якість води на пляжах*станом на*` |
| https://phc.org.ua/news/yakist-vodi-na-plyazhakh-ukraini-stanom-na-8-serpnya-de-bezpechno-kupatisya | Same slug pattern — **page body dated 2025-08-08** (slug collision risk across years) | Prefer date in page body + `опубліковано` |
| https://phc.org.ua/news/yakist-vodi-na-plyazhakh-ukraini-stanom-na-9-lipnya-de-bezpechno-kupatisya | July 2026 brief (linked from site) | Archive crawl |
| https://phc.org.ua/news/yakist-vodi-u-vodoymakh-i-richkakh-u-mezhakh-plyazhiv-monitoring-vodnikh-obektiv-6 | 2024-08-30 style (ЛКП stats) | Historical schema / thresholds |
| https://phc.org.ua/news/informaciya-pro-yakist-vodi-u-mezhakh-plyazhiv | Older programme overview (counts of monitored sites) | Rarely updated |
| https://phc.org.ua/monitoring-i-statistika | Monitoring hub — **no dedicated bathing RSS** | Poll news index |

**Subscribe strategy:** scrape `phc.org.ua/news` (or search) weekly May–Sep for title contains `Якість води` + `пляж`. No official RSS dedicated to beaches found. Diff snapshot JSON by beach id.

### Kyiv / oblast excerpt — brief 2026-08-06
- **Kyiv (as of 30 Jul samples in that brief):** compliant list includes Венеція, Веселка, Молодіжний, Дитячий, Золотий, Передмістна слобідка, Центральний, Чорторий, Тельбін, Райдуга, Троєщина (Десенка), Галерний, Острів Оболонь, Вербний, Пуща-Водиця 5–7. Season not opened.
- **Kyiv oblast:** compliant **дитячий пляж «Чайка»** (с. Чайки, Обухівський р-н, р. Рось). Season not opened.
- **Not sampled that week (oblast):** міські пляжі Переяслав (Канівське вдсх.) and «Центральний» Біла Церква (Рось) — **no official beach status in 2026**.

Artifact: [`water-quality-snapshot.json`](water-quality-snapshot.json).

---

## 2. Держпродспоживслужба

### Kyiv oblast GU
| URL | Role |
|-----|------|
| https://dpssko.gov.ua/ | News hub — **food safety / veterinary** dominant in 2026 feed |
| https://dpssko.gov.ua/blog/2024/05/31/соціально-гігієнічний-моніторинг-на/ | Notes SGH monitoring jointly with **Київський ОЦКПХ**; focuses on **pitna / wells**, not beach lists |

**Finding:** DPSSKO is **not a reliable live bathing feed**. Recreational water results for the oblast surface primarily via **ЦГЗ aggregation** and occasional local media, after lab work by **ОЦКПХ** under interaction protocols.

### National DPSS
No Kyiv-specific recreational water API identified for this research pass. Treat DPSS as secondary confirmation / legal response channel, not scrape primary.

---

## 3. Лабораторні центри / ЦКПХ / Плесо

### Київський міський ЦКПХ
| URL | Fields typically available | Cadence |
|-----|----------------------------|---------|
| https://kyiv.cdc.gov.ua/ | News + articles | Seasonal |
| https://kyiv.cdc.gov.ua/news/yakist-vody-na-kyyivskyh-plyazhah-aktualna-informatsiya/ | Narrative ok / advisory (2026-07-13–14 samples) | Ad hoc posts |
| https://kyiv.cdc.gov.ua/news/yaka-yakist-vody-na-plyazhah-kyyeva-na-pochatku-litnogo-sezonu/ | Early-season ok/fail lists (2026-06-02) | Ad hoc |
| https://kyiv.cdc.gov.ua/articles/rezultaty-monitoryngu-yakosti-vody-vidkrytyh-vodojm-ta-gruntu-pisku-v-zonah-rekreatsiyi-plyazhah-m-kyyeva-z-19-08-2024r-po-25-08-2024r/ | **Table**: beach × {sanChem, micro, parasitology} = відповідає / не відповідає | Weekly in peak 2024 |

**Machine-friendly gold:** weekly **articles** with HTML tables (pattern `Результати моніторингу якості води*пляж*`). Parse three dimensions; map overall `status`:
- all відповідає → `ok`
- micro fail → `unsafe` (contact swim)
- chem fail only → `advisory`
- parasitology fail rare → `unsafe`

### Київський обласний ЦКПХ
| URL | Notes |
|-----|-------|
| https://kv.cdc.gov.ua/ | Home / news; **little on-beach listing** in summer 2026 surface crawl |
| https://kv.cdc.gov.ua/activity/laboratory-studies/ | Confirms labs test **surface waters** among other matrices — no public beach board |

Expect oblast beaches (Чайка, Переяслав, Біла Церква) to appear mainly in **ЦГЗ national briefs**.

### КП «Плесо»
| URL | Notes |
|-----|-------|
| http://pleso.kyiv.ua/лабораторія/ | Lab capability description (≈80 indicators) — **no live results table** |
| http://pleso.kyiv.ua/локації/ | Beach management / safety rules; cites МОЗ orders №172 / №173 |
| https://pleso.kyiv.ua/wp-json/wp/v2/posts | **WordPress REST** — best Pleso scrape endpoint for water posts |
| https://kyivcity.gov.ua/news/sanitarno-mikrobiologichni_pokazniki_vodi_na_munitsipalnikh_plyazhakh_kiyeva_vidpovidayut_normi__pleso/ | **2026-08-07**: samples **2026-08-04**, claims all municipal beaches micro **in norm** |

City / Pleso press notes often **lack per-beach names** → store as `bulkClaim` with lower confidence than ЦКПХ/ЦГЗ named lists. Deeper Pleso research: [`pleso-bathing.md`](pleso-bathing.md), [`pleso-water-quality-snapshot.json`](pleso-water-quality-snapshot.json).

---

## 4. Open data portals

### data.kyivcity.gov.ua (best open layer for beach **locations**)
| Resource | URL | Fields |
|----------|-----|--------|
| Dashboard | https://data.kyivcity.gov.ua/dashboard/munitsypalni-pliazhi-kyieva | UI: status + infrastructure filters |
| CKAN dataset | `perelik-munitsypalnykh-pliazhiv-kyieva-dep-ecology` | GeoJSON via ArcGIS |
| ArcGIS query | see catalog file | `objectid`, `globalid`, `name`, `district`, `waterobject`, `beachstatus`, amenities flags, `point_x/y` |

Downloaded catalog: [`kyiv-municipal-beaches-catalog.json`](kyiv-municipal-beaches-catalog.json) (15 beaches).  
**Encoding caveat:** GeoJSON HTTP body may arrive as **Windows-1251** (or already-fixed UTF-8 depending on client); verify Cyrillic before ingest. Sibling download: [`municipal-beaches.geojson`](municipal-beaches.geojson).  
**Semantics caveat:** `beachstatus` (0/1) is the IAS «чи можна купатись» catalogue flag — **not** a laboratory LKP/E.coli result. Still keep separate from `waterQuality.status`.

### data.gov.ua (national)
| Dataset | URL | Useful for paddle map? |
|---------|-----|------------------------|
| Дані державного моніторингу поверхневих вод | https://data.gov.ua/dataset/surface-water-monitoring | Chemistry stations (O₂, BOD, NH₄, etc.) — **environmental**, not bathing “можна купатися” |
| Portal app «Чиста Вода» | https://data.gov.ua/apps/show/5 | Viz over DAWR network |
| DAWR monitoring portal | http://monitoring.davr.gov.ua/ | Live-ish station pages |
| Local city sets (Lviv etc.) | various | **No Kyiv recreational bathing set** found |

**Conclusion:** Use DAWR CSVs for river chemistry context / Desna incident support; **do not** substitute for recreational beach status.

---

## 5. Rivers from the plan (Desna, Irpin, etc.)

| Waterbody | Appears in recreational public data? | Notes for map |
|-----------|--------------------------------------|---------------|
| **Десна** / Десенка | Beach **Троєщина** on Десенка; Чернігів «Золотий берег» on Десна in national briefs | Spot `desna-mouth`; 2024 **Seim→Desna organic pollution** incident (MEPR/DAVR/TEB swim bans) → `incidents[]` |
| **Ірпінь** | **Not** in ЦГЗ named beach lists (no official Irpin beach samples found) | Spot `irpin-river` stays `unknown` for lab status |
| **Рось** | Оblast: Чайка (Обухів); Біла Церква «Центральний» often **non-official / unsampled / micro fail** in archives | Spot `bila-tserkva-ros` |
| **Тетерів** | Mentioned for **Zhytomyr** Hydropark fails in national briefs — edge of Kyiv oblast only | Spot `teteriv-edge` → usually `unknown` |
| **Стугна / Трубіж / Здвиж** | Not in bathing digests | `unknown` |
| **Дніпро / озера Києва** | Core of municipal beach programme | Map via beach IDs → spots |

Desna/Seim incident hub URLs:
- https://mepr.gov.ua/aktualna-informatsiya-shhodo-zabrudnennya-richok-sejm-ta-desna/
- https://mepr.gov.ua/usefullinks/reaguvannya-na-nadzvychajnu-podiyu-na-richkah-sejm-ta-desna/
- https://davr.gov.ua/news/informaciya-tshodo-zabrudnennya-richok-sejm-ta-desna-

---

## 6. Recommended stable IDs & schema

### Location IDs
1. **Municipal beaches:** `beach-*` slugs from [`kyiv-municipal-beaches-catalog.json`](kyiv-municipal-beaches-catalog.json); also keep `objectid` + `globalid` for GIS joins.
2. **Oblast known beaches:**
   - `beach-oblast-chaika-obukhiv` — дит. пляж Чайка, Рось
   - `beach-oblast-pereiaslav-city` — міський пляж Переяслав / Канівське
   - `beach-oblast-bila-tserkva-central` — «Центральний», Рось
3. **Spots / rivers:** reuse existing `spots.json` ids (`telbin`, `desna-mouth`, `irpin-river`, …) via `linkedSpotIds` / `bySpotId`.
4. **River tokens:** `byRiverNameToken` as in plan (`десна`, `ірпінь`, `рось`, …) — only when sample or incident is river-wide.

### Recommended live fields (aligns with plan `waterQuality` + scrape extras)

```ts
type WqStatus = 'ok' | 'advisory' | 'unsafe' | 'unknown'

interface WaterQualitySample {
  locationId: string              // beach-* | spot id | river token
  status: WqStatus
  sampledAt?: string              // ISO date of lab sample (not publish date)
  publishedAt?: string
  labName?: string                // e.g. "Київський міський ЦКПХ МОЗ", "КП Плесо"
  sourceUrl: string
  sourceKind: 'phc_brief' | 'cdc_table' | 'cdc_news' | 'pleso_press' | 'davr' | 'mepr' | 'other'
  seasonOfficiallyOpen?: boolean
  dims?: {
    sanitaryChemical?: 'pass' | 'fail' | 'unknown'
    microbiological?: 'pass' | 'fail' | 'unknown'
    parasitological?: 'pass' | 'fail' | 'unknown'
  }
  parameters?: {
    lkpIndex?: number             // ЛКП; threshold historically 5000
    eColi?: number
    notesUk?: string
  }
  labelUk?: string
  confidence: 'high' | 'medium' | 'low'
  appliesTo?: 'beach_only' | 'waterbody_reach' | 'whole_river'
  checkedAt: string
}

interface WaterQualityIncident {
  id: string                      // e.g. incident-desna-seim-2024
  status: 'unsafe' | 'advisory'
  rivers: string[]                // river name tokens
  startedAt: string
  endedAt?: string
  titleUk: string
  sources: string[]
}
```

File target (later, not written for UI yet): `public/data/water-quality.json` with `{ samples: [], bySpotId: {}, byRiverNameToken: {}, incidents: [], meta }`.

### Status precedence (for scrapers)
1. Active `incidents[]` overlapping geometry/token → force `unsafe` / `advisory`
2. Named ЦКПХ table row (high)
3. ЦГЗ named beach in weekly brief (medium–high)
4. Плесо/KMDA bulk claim (medium/low)
5. Else `unknown`

---

## 7. Live-update blueprint (phase 2 scrape)

1. **Daily (summer):** ArcGIS beaches GeoJSON → refresh coords/amenities (`beachstatus`).
2. **2–3×/week:** Discover latest ЦГЗ title match → parse Kyiv/oblast bullets → upsert samples.
3. **Same cadence:** Poll `kyiv.cdc.gov.ua` news/articles for table posts → prefer over ЦГЗ when both exist.
4. **Weekly:** kyivcity.gov.ua / Pleso keywords for bulk claims.
5. **Rare:** MEPR/DAVR incident keywords (`Десна`, `Сейм`, `заборона купання`).

Suggested script name (from plan): `scripts/scrape-water-quality.mjs` → writes research or `public/data/water-quality.json`.

---

## 8. Artifacts in this folder

| File | Purpose |
|------|---------|
| [`water-quality-bathing-safety.md`](water-quality-bathing-safety.md) | This report (МОЗ/ЦГЗ, ДПСС, ЦКПХ, open data, schema) |
| [`water-quality-snapshot.json`](water-quality-snapshot.json) | Placeholder samples + source registry + schema stub |
| [`kyiv-municipal-beaches-catalog.json`](kyiv-municipal-beaches-catalog.json) | 15 municipal beaches with stable `beach-*` IDs + spot links |
| [`pleso-bathing.md`](pleso-bathing.md) / [`pleso-water-quality-snapshot.json`](pleso-water-quality-snapshot.json) | Parallel deep-dive on КП «Плесо» + WP REST |
| [`municipal-beaches.geojson`](municipal-beaches.geojson) | Raw/normalized ArcGIS beach points |
| [`water-incidents.md`](water-incidents.md) / [`water-incidents.json`](water-incidents.json) | Spills / blooms / Desna-class `incidents[]` sources |
| `_parse_beaches.py` | Helper to rebuild beach catalog from ArcGIS download |
