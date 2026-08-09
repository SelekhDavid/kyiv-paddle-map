# River width merge report

`mergedAt`: 2026-08-08T21:49:06.587Z  
Protocol: `docs/methodology-river-width-fusion.md`  
Output: `public/data/river-widths.json`

## Inputs

| priority | method | silo file | usable rows ingested |
|---------:|--------|-----------|---------------------:|
| 1 | field | sentinel-field.json | 0 |
| 2 | osm_polygon | osm-polygon.json | 35 |
| 3 | swot_sword | swot-sword.json | 66 |
| 4 | grwl_rivwidth | grwl-rivwidth.json | 25 |
| 5 | merit_wth | merit-wth.json | 0 (awaiting_offline_raster) |
| 6 | osm_width_tag | osm-width-tag.json | 263 |

Rules applied: credibility rank for `widthM`; no silent averages; SWOT/GRWL without silo `osmId` → `samples[]` only (no ≤0.5 km re-snap); skip null/0 widthM; same-method ties prefer medium+ over lakeFlag=1.

## Outputs

| artifact | count |
|----------|------:|
| `byOsmId` keys | 301 |
| entries with `alternates[]` | 3 |
| `samples[]` | 77 |
| skipped (no width) | 1 |
| skipped (outside bbox) | 4 (osm_width_tag tips west/south of MAP_EXTENT) |

### Winner method breakdown (`byOsmId`)

| method | winners |
|--------|--------:|
| field | 0 |
| osm_polygon | 35 |
| swot_sword | 0 |
| grwl_rivwidth | 10 |
| merit_wth | 0 |
| osm_width_tag | 256 |

### Samples by methodId

| methodId | count |
|----------|------:|
| swot_sword | 66 |
| grwl_rivwidth | 11 |

## Notes

- `fetchedAt: null` — curated merge of research silos, not a live poll.
- `field` and `merit_wth` contributed no widths this run.
- All 66 SWOT reaches lack `osmId` → entirely in `samples[]` (silo on disk; earlier 69 figure was superseded by a later silo write).
- GRWL: 10 unique osmIds entered `byOsmId`; 11 unmatched points stayed in `samples[]`.
- `osm_width_tag` winners = 256 = 263 usable − 4 out-of-bbox − 3 lost as alternates under higher-priority methods.
