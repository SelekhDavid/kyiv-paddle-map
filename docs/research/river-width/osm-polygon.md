# OSM polygon orthogonal widths (method silo)

`methodId`: `osm_polygon` · priority **2**

## How

RivWidth-style bank normals → midpoints → thinned centerline → local orthogonals through `water=river|canal|stream` Polygon/MultiPolygon features in `public/data/water-shapes.geojson`, clipped to `MAP_EXTENT` (`src/lib/mapExtent.ts`).

Blob-like polygons (`4·area/perimeter > 900 m`) and tiny scraps are skipped.

## Commands

```bash
# full in-bbox river polygons
node scripts/estimate-osm-polygon-widths.mjs

# priority names only: Дніпро, Десна, Ірпінь, Тетерів, Рось
node scripts/estimate-osm-polygon-widths.mjs --priority
```

Output: `docs/research/river-width/osm-polygon.json` (this silo only — not merged into `public/data/river-widths.json`).

## Coverage note

Local shapes have few river-area polygons. Ірпінь / Рось often lack `water=river` areas in this extract (line-only) — absent from this silo.
