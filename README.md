# Київщина SUP / swim map

Interactive map of swim & paddle-board spots in **Kyiv city, Kyiv oblast, and adjacent waters**.

## Stack

- Vite + React + TypeScript
- Leaflet / OpenStreetMap tiles
- Curated spot dataset + optional OSM Overpass layer

## Important (martial law)

Kyiv Oblast Military Administration has published an ongoing **civilian navigation ban** on waterbodies (small craft, recreational/sports craft, water entertainment equipment). SUP/kayaks typically fall under this.

This app surfaces restriction status from **public OVA/community sources**. It is **not a legal permit**. Always re-check current local orders before entering the water.

## Tourist-load grades

Grades are **curated** (1–5) from public tourism guides, SUP rental pages, and city beach coverage — not live social-media scraping (ToS / rate limits). See `public/data/rules.json`.

## Commands

```bash
npm install
npm run fetch-shapes   # Overpass → public/data/water-shapes.geojson
npm run scrape-bans    # Live public pages → classification-meta.json (checkedAt)
npm run classify-rivers # Rules + meta → classification.json (all river osmIds)
npm run dev
npm run build          # production → dist/
```

## Live map

Live: **https://selekhdavid.github.io/kyiv-paddle-map/**

Scrape is best-effort: some URLs may fail (timeouts / blocks). Classification still falls back to oblast-default rules from whatever signals succeed. Re-run scrape periodically; the UI shows **Інформація станом на {checkedAt}**.

Toggle “усі OSM контури” in the sidebar for polygon waters; rivers use colored classification (no unclassified blue overlay).

**Display rules** (point vs polygon vs river line, modes, integrity): [`docs/methodology-waterbody-display.md`](docs/methodology-waterbody-display.md).

## Data files

| File | Role |
|------|------|
| `public/data/spots.json` | Curated paddle/swim spots + restrictions + load |
| `public/data/rules.json` | Regional rules & methodology |
| `public/data/water-shapes.geojson` | OSM polygons + river lines (generated) |
| `public/data/classification-meta.json` | Scrape results + `checkedAt` |
| `public/data/classification.json` | Per-river restriction level |
| `public/data/osm-water.geojson` | Optional named OSM points (legacy) |
