# Tippecanoe → water.pmtiles

`checkedAt`: 2026-08-10

## Чому CI

На Windows немає офіційного tippecanoe binary. Збірка йде на **GitHub-hosted Ubuntu** (не на вашому ПК).

## Запуск

1. Увімкніть workflow scope для `gh` (якщо push workflow файлу блокується):
   ```bash
   gh auth refresh -s repo,workflow
   ```
2. Запустіть:
   ```bash
   gh workflow run "Build water PMTiles"
   gh run watch
   ```
3. Або Actions → **Build water PMTiles** → Run workflow.

Workflow збирає `public/data/water.pmtiles` tippecanoe’єм і **комітить** у `main`, якщо файл змінився. Artifact також у run.

## Локально (опційно)

- WSL / macOS / Linux з `tippecanoe` на PATH: `npm run build:pmtiles`
- Windows без tippecanoe: той самий скрипт падає на **legacy** geojson-vt (якщо не `CI=true`)

## Pipeline

1. `prepare-water-for-tiles.mjs` — лише геометрії з `matchedOsmId(s)` зі spots  
2. `tippecanoe` z6–13, buffer 64, shared borders, coalesce  
3. шар MapLibre: `water`
