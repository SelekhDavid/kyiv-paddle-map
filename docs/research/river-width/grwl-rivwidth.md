# GRWL / RivWidth — river-width silo (priority 4)

Collected: `2026-08-08T21:33:24Z`

## Dataset

| Item | Value |
|------|--------|
| Name | Global River Widths from Landsat (GRWL) Database |
| Version | V01.01 |
| DOI / page | https://doi.org/10.5281/zenodo.1297434 |
| License | **CC-BY-4.0** |
| Paper | Allen & Pavelsky 2018, *Science* — https://doi.org/10.1126/science.aat0636 |

### Exact download URLs (Zenodo API)

- Summary vector (used here, ~43 MB): https://zenodo.org/api/records/1297434/files/GRWL_summaryStats_V01.01.zip/content
- Full centerline vector (~3.1 GB): https://zenodo.org/api/records/1297434/files/GRWL_vector_V01.01.zip/content
- Water mask (~394 MB): https://zenodo.org/api/records/1297434/files/GRWL_mask_V01.01.zip/content
- Tile index (Drive): https://drive.google.com/file/d/1K6x1E0mmLc0k7er4NCIeaZsTfHi2wxxI/view?usp=sharing

### Google Earth Engine (community catalog)

- https://gee-community-catalog.org/projects/grwl/
- `projects/sat-io/open-datasets/GRWL/grwl_SummaryStats_v01_01`
- `projects/sat-io/open-datasets/GRWL/water_vector_v01_01`
- `projects/sat-io/open-datasets/GRWL/water_mask_v01_01`

### RivWidthCloud

Not a published global width table — GEE algorithm that extracts widths from Landsat and uses GRWL as channel reference: https://github.com/seanyx/RivWidthCloudPaper

## Map bbox

`south=49.85, west=29.2, north=51.28, east=32.3` (`src/lib/mapExtent.ts`)

## Extraction done

- Downloaded **GRWL_summaryStats_V01.01** (manageable).
- Found **13** polyline segments intersecting the map bbox (product is sparse: junction-to-junction summaries; rivers ≲30 m usually absent).
- Sampled centerline points ~every 10 km inside bbox; `widthM` = `width_med_`.
- Snap to local `water-shapes.geojson` only when ≤0.5 km (else `osmId: null`).

## Got vs blocked

| River | Status |
|-------|--------|
| Дніпро | **Got** — city stem ~250 m; Київське/Канівське `lakeFlag=1` (med ~2.9–9.4 km open water) |
| Десна | **Got** — ~50–260 m (`width_med_`) along mapped reaches |
| Тетерів | **Got** — ~48 m mid-basin (western map half); mouth into reservoir dropped as ambiguous |
| Рось | **Absent** in GRWL summary for this bbox (typically ≲30 m / not mapped) |

**Blocked for denser points:** full `GRWL_vector_V01.01.zip` (~3.1 GB) not downloaded; Zenodo does not host per-tile vector files. Path forward: (1) GEE filter `water_vector_v01_01` to bbox and export, or (2) download full zip and subset tiles covering ~N48–N52 / E024–E036.

## Output

`docs/research/river-width/grwl-rivwidth.json` — 25 features.
