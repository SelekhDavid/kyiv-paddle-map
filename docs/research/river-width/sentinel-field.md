# Sentinel / field — збір ширин (метод `sentinel_field`)

`collectedAt`: 2026-08-08T21:30:20Z  
Priority: **1** (найвищий, коли є точкові спостереження)  
Артефакт: [`sentinel-field.json`](./sentinel-field.json)

## Результат майнінгу

| Джерело | Числові ширини (м) | Примітка |
|---------|-------------------|----------|
| `public/data/spots.json` | **0** | notes/tips без bank-to-bank метрів |
| `public/data/club-trip-reports.json` | **0** | якісно: Ірпінь — «вузьке русло» |
| `docs/research/*` | **0** | без обчислених Sentinel-2 width |
| `docs/methodology-river-width.md` | н/д | лише методика (приклад `width=12` — не вимір) |

**Sample count: 0** — чесне порожнє `features[]`. Числа не вигадані.

## Sentinel-2 playbook

Див. `sentinelPlaybookUk` у JSON (NDWI/MNDWI → ортогоналі до осі → `widthM`; не запускалось у цій збірці).
