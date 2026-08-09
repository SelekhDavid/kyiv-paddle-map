# SWOT / SWORD river width silo (priority 3)

Collected: `2026-08-08T21:46:29Z`

## Result
- **Reach features in Kyiv bbox:** 69
- **With kept Hydrocron SWOT observation:** 14
- **By river:** {"Дніпро": 21, "невідомо": 19, "Десна": 15, "Тетерів": 10, "Ljubych": 3, "Припʼять": 1}

BBox: south=49.85, west=29.2, north=51.28, east=32.3 (`src/lib/mapExtent.ts`).

## Access playbook
- 1) Знайти PFAF_ID L06 через HydroBASINS (для Києва ~225190 Дніпро, ~225300 гирло Десни).
- 2) FTS: GET https://fts.podaac.earthdata.nasa.gov/rivers/reach/{prefix}?page_size=100&page_number=N — повертає reach_id, width, wse, x/y, river_name, geometry.
- 3) Сучасні SWOT width/wse: Hydrocron GET https://soto.podaac.earthdatacloud.nasa.gov/hydrocron/v1/timeseries?feature=Reach&feature_id={reach_id}&start_time=...&end_time=...&fields=reach_id,time_str,wse,width&output=csv (без ключа; 400 якщо немає рядків).
- 4) Повні Continent-pass shapefile: CMR bbox-пошук short_name=SWOT_L2_HR_RiverSP_D + Earthdata Login на archive.swot.podaac (protected).
- 5) Офлайн база: Zenodo SWORD_v17b_* або http://gaia.geosci.unc.edu/SWORD/ (eu_sword_* / hb22).

## Blocks in this environment
- **ftsRiverName:** GET /rivers/river/name/{Dnieper|Desna|...} → HTTP 403 у цьому середовищі (WAF).
- **podaacProtectedZip:** HTTPS granules на archive.swot.podaac.../podaac-swot-ops-cumulus-protected потребують Earthdata Login; без обліковки не завантажено.
- **fullEuNetcdf:** Повний SWORD zip ~1.7–2.0 GB; замість нього використано FTS за PFAF-префіксами bbox.
- **hydrocronGaps:** Частина reach (особливо type=3 lake-on-river) не має Hydrocron timeseries → лишається SWORD prior width.

## Notes
- `widthM` = SWORD prior (GRWL-based) unless a Hydrocron SWOT width passed outlier checks vs prior.
- Reach IDs ending in `3` are lake-on-river (Київське водосховище etc.) — widths may be reservoir-scale.
- Output file: `docs/research/river-width/swot-sword.json`
