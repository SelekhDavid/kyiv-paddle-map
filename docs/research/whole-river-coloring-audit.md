# Audit: whole-river coloring (2026-08-08)

## Problem
`byRiverNameToken` painted **every** OSM way with that name `restricted`, even outside the hromada that issued the ban.

| Token / river | Before (whole-name) | After (community bbox only) |
|---------------|---------------------|-----------------------------|
| Здвиж | 21/21 restricted | **3** restricted / **18** likely_ok |
| Буча | 13/13 | **9** / **4** |
| Рокач | 14/14 | **11** / **3** |
| Горенка, Котурка, Любка, Мислин | all restricted | still all restricted (segments lie inside community bboxes) |
| Ірпінь / Десна | fixed earlier | 5/36 and 4/12 restricted |

Removed all entries from `local-rules.json` → `byRiverNameToken`. Classifier uses community `bbox` + curated spots (≤25 km). Token rules, if re-added, **must** include `bbox`.

## Border cut
Map extent north = **51.28** (omit Belarus border belt / deep Chernihiv). Applied at load (`filterFeaturesToMapExtent`) and in `fetch-shapes` BBOX for future fetches.
