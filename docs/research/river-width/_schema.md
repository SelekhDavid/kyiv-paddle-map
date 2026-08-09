# Схема silo: `docs/research/river-width/`

Спільний контракт для **усіх** метод-колекторів. Один файл = один `method`.  
Протокол злиття: [`docs/methodology-river-width-fusion.md`](../methodology-river-width-fusion.md).

`checkedAt`: 2026-08-09 · `schemaVersion`: **1**

---

## Hard rules (коротко)

- Писати **лише** свій `<method>.json` у цій теці.
- **Не** читати sibling-силоси; **не** писати `public/data/river-widths.json`.
- **Один** write за прогін, потім стоп.
- `method` у файлі **мусить** збігатися з іменем файлу (без `.json`).

---

## Імена файлів

| Файл | `method` | priority |
|------|----------|----------|
| `field.json` | `field` | 1 |
| `osm_polygon.json` | `osm_polygon` | 2 |
| `swot_sword.json` | `swot_sword` | 3 |
| `grwl_rivwidth.json` | `grwl_rivwidth` | 4 |
| `merit_wth.json` | `merit_wth` | 5 |
| `osm_width_tag.json` | `osm_width_tag` | 6 |

`_schema.md` — документація, не silo даних.

---

## Форма silo JSON

```json
{
  "schemaVersion": 1,
  "method": "osm_polygon",
  "priority": 2,
  "updatedAt": "2026-08-09T00:00:00.000Z",
  "bbox": {
    "south": 49.85,
    "west": 29.2,
    "north": 51.28,
    "east": 32.3
  },
  "source": {
    "nameUk": "Коротка назва джерела",
    "urls": [],
    "noteUk": "Як збирали / обмеження цього прогону"
  },
  "byOsmId": {
    "123456789": {
      "widthM": 14.2,
      "widthP10": 11.0,
      "widthP50": 14.2,
      "widthP90": 18.5,
      "nSamples": 7,
      "confidence": "high",
      "checkedAt": "2026-08-09T00:00:00.000Z",
      "lat": 50.45,
      "lng": 30.52,
      "meta": {}
    }
  },
  "samples": [
    {
      "id": "rw-field-irpin-01",
      "osmId": "123456789",
      "lat": 50.52,
      "lng": 30.25,
      "widthM": 9.5,
      "confidence": "medium",
      "checkedAt": "2026-08-09T00:00:00.000Z",
      "noteUk": null,
      "meta": {}
    }
  ]
}
```

Порожній валідний silo (після прогону без знахідок або до старту):

```json
{
  "schemaVersion": 1,
  "method": "<method>",
  "priority": <1-6>,
  "updatedAt": "2026-08-09T00:00:00.000Z",
  "bbox": {
    "south": 49.85,
    "west": 29.2,
    "north": 51.28,
    "east": 32.3
  },
  "source": {
    "nameUk": "",
    "urls": [],
    "noteUk": "empty stub / no measurements this run"
  },
  "byOsmId": {},
  "samples": []
}
```

---

## Поля

| Поле | Обов’язкове | Опис |
|------|-------------|------|
| `schemaVersion` | так | Зараз `1` |
| `method` | так | Один із 6 id; = ім’я файлу |
| `priority` | так | 1…6 згідно з fusion-таблицею (дублює контракт для merge) |
| `updatedAt` | так | ISO час цього write |
| `bbox` | так | Як `MAP_EXTENT` |
| `source` | так | Метадані прогону (не плутати з переможцем у злитому файлі) |
| `byOsmId` | так | Основний вихід: ключ = OSM way id (string), як у `water-shapes` |
| `samples` | так | Точкові виміри; може бути `[]`. Для sparse `field` / Sentinel-2 часто зручніше samples |

### Запис у `byOsmId[osmId]` / елемент `samples[]`

| Поле | Опис |
|------|------|
| `widthM` | Ширина в метрах (число); `null` лише якщо явно «немає виміру» — краще взагалі не класти ключ |
| `widthP10` / `widthP50` / `widthP90` | Опційно для ортогональних методів |
| `nSamples` | Кількість ортогоналей / спостережень |
| `confidence` | `high` \| `medium` \| `low` (у silo — оцінка **цього** методу, не після fusion) |
| `checkedAt` | ISO |
| `lat` / `lng` | Репрезентативна точка (серед сегмента або sample) |
| `osmId` | У `samples[]` — опційний join до way |
| `id` | У `samples[]` — стабільний локальний id (`rw-<method>-…`) |
| `meta` | Вільний об’єкт (reach id SWOT, GRWL id, raw tag тощо); merge може ігнорувати |

---

## Що merge читає

1. Усі існуючі `<method>.json` з `schemaVersion: 1`.
2. Для кожного `osmId` — оцінки з `byOsmId` (+ samples з `osmId`, якщо потрібно).
3. Вибір `widthM` за priority 1→6; решта → `alternates[]` у `public/data/river-widths.json`.

Collectors **не** формують `alternates` і **не** обирають переможця.

---

## Приклад порожніх шаблонів (опційно скопіювати)

Не обов’язково тримати в git шість порожніх файлів до першого прогону; якщо зручно стартувати — достатньо скопіювати «порожній валідний silo» вище з підставленими `method` / `priority`.
