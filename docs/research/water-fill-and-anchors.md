# Дослідження: заливка великих водойм і розташування точок

`checkedAt`: 2026-08-10  
Scope: Kyiv oblast map (Svelte + MapLibre + PMTiles shell).  
Фокус: **і** рвана/подвійна заливка, **і** якірні точки.

Пов’язано: [methodology-waterbody-display](../methodology-waterbody-display.md), [stack-svelte-maplibre](../stack-svelte-maplibre.md), [ui-roadmap](../ui-roadmap.md).

---

## 1. Дві різні проблеми

| | Заливка | Точки |
|--|---------|--------|
| Симптом | рвані краї, «дірки», dual-water з Carto | маркер на суші / один pin на весь Дніпро |
| Корінь | clip тайлів + складна MultiPolygon + basemap | centroid / hand coords ≠ interior |
| Канон | MVT buffer + simplify + ETL `make_valid` + політика «що малювати» | `polylabel` / `ST_PointOnSurface` + zoom-roles |

---

## 2. Як роблять у індустрії

**Заливка:** OpenMapTiles / tippecanoe / Planetiler — buffer 64–128, per-zoom simplify, окремі шари area vs line; invalid geometry чистять в ETL.

**Точки:** Mapbox `polylabel`, Turf `pointOnFeature`, PostGIS `ST_PointOnSurface` — не mean вершин.

**Річки:** статус на сегментах; широкий areal — окремий water polygon; не один centroid на всю назву.

---

## 3. Що ламається у нашому пайплайні

- PMTiles через `geojson-vt` (`buffer: 64`, z≤12, `tolerance: 3`)
- Overpass MultiPolygon relations у `fetch-shapes.mjs`
- Carto `light_all` уже малює воду + наш fill
- Shell показував **усі** fills; Spot lat/lng без interior snap

---

## 4. Locked план робіт (ROI)

| ID | Рішення | Статус |
|----|---------|--------|
| B1 | Interior anchors для standing | superseded: **точки прибрано**; якір лише для fitBounds |
| A1 | Dual-water | done |
| A4 | Fill лише matched standing | done → еволюція: **кольорова клікабельна заливка + лінії річок** |
| Click-fill | Немає pin; select = fill/line + список | done |
| A2 | `make_valid` / rewind у build:pmtiles | далі |
| A3 | tippecanoe + більший buffer / maxzoom | далі |
| B2/B3 | Zoom-roles; Дніпро як сегменти, не один pin-meta | далі (ui-roadmap) |

---

## 5. Non-goals зараз

- PostGIS заради заливки
- Vertex-mean як якір
- Зшивання всієї назви річки в один MultiLine для маркера
