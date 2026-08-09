# MERIT Hydro `wth` (метод D, priority 5)

**Status:** `awaiting_offline_raster` — `features: []` (без вигаданих ширин).

## Джерело

- Product: [MERIT Hydro](https://global-hydrodynamics.github.io/MERIT_Hydro/) (Yamazaki Lab, IIS U-Tokyo), v1.0.1.
- Paper: Yamazaki et al. (2019), WRR — https://doi.org/10.1029/2019WR024873
- Variable: `wth` — channel width (m) at centerlines; ~3″ (~90 m) GeoTIFF.
- Nodata: `>0` = width m; `-1` = water off-centerline; `0` = land; `-9999` = undefined/ocean.
- Mirror/runtime: GEE `ee.Image("MERIT/Hydro/v1_0_1")` band `wth`.
- Download: registration form → Dropbox password (немає анонімного bulk URL у репо).

## Map bbox tiles

`MAP_EXTENT` 49.85–51.28 N, 29.2–32.3 E → tiles `n45e025`, `n45e030`, `n50e025`, `n50e030` з пакетів `wth_n30e000.tar`, `wth_n30e030.tar`.

## Чому порожньо

У workspace немає локальних `*_wth.tif`. Dropbox gated; семплінг без растра був би фальсифікацією. Детальні кроки — у `merit-wth.json` → `playbookUk`.
