# Stack lock: Svelte + MapLibre + PMTiles

`acceptedAt`: 2026-08-10  
Статус: **shell v1** (мапа + PMTiles контури + базовий список). Повний порт режимів/фільтрів/detail — наступні ітерації ([ui-roadmap](./ui-roadmap.md)).

Суперседить попередню рекомендацію «залишити React» у [tech-stack-research](./tech-stack-research.md) для **продуктового UI**.

---

## Locked

| ID | Рішення |
|----|---------|
| S1 | **Svelte 5** + Vite + TypeScript |
| S2 | **MapLibre GL JS** (не Leaflet) |
| S3 | Важка геометрія водойм → **`public/data/water.pmtiles`** (шар `water`) |
| S4 | Смислові дані лишаються static JSON (`spots.json`, …) |
| S5 | Hosting: GitHub Pages (`base: /kyiv-paddle-map/`) |

---

## Build PMTiles

```bash
npm run fetch-shapes   # якщо треба оновити GeoJSON
npm run build:pmtiles  # → public/data/water.pmtiles
```

Пайплайн: `scripts/build-water-pmtiles.mjs` (geojson-vt + vt-pbf) → `scripts/_pack_pmtiles.py` (pmtiles Writer). Потрібні Node + Python-пакет `pmtiles`.

---

## Shell scope (зараз)

- Map-first fullscreen
- Floating search + spot list
- Restriction-colored point markers
- Water fill/line from PMTiles
- Legal strip знизу

## Not yet (повернути з React-епохи / roadmap)

- Режими restrictions / paddle / detail
- FilterPanel layers, WQ, hazards, hydro, flow arrows
- SpotDetail drawer, derived spots, OSM binds enrichment

Див. [ui-roadmap](./ui-roadmap.md) P0–P3 — виконувати вже на Svelte.
