# Методика: гідропости (рівні води)

`checkedAt`: 2026-08-09  
Scope: Київська область (операційний bbox мапи) + пріоритетні річки з плану (Десна, Тетерів, Рось, Ірпінь, Стугна, Трубіж, Здвиж).  
Мета: **структуровано** збирати спостереження УкрГМЦ і показувати їх окремим шаром на мапі SUP / плавання — **без** змішування з кольорами заборон.

Пов’язано: [methodology-waterbody-display.md](./methodology-waterbody-display.md) (гідро — overlay у режимі «детально», не роль геометрії водойми).

---

## 1. Джерела і довіра

| Джерело | Роль | URL |
|---------|------|-----|
| **Укргідрометцентр (meteo.gov.ua)** | Первинне / офіційне | [Мережа гідропостів](https://www.meteo.gov.ua/ua/Faktichni-sposterezhennya-merezhi-hidrolohichnikh-postiv), [автоматичні пости](https://www.meteo.gov.ua/ua/Dani-avtomatichnikh-hidrolohichnikh-postiv) |
| **hydro-ua.com** | Зручне JSON-дзеркало агрегованих даних УкрГМЦ | `https://hydro-ua.com/api/hydroday.json`, `https://hydro-ua.com/api/hydroauto.json` |

**Довіра:** рівні й координати беремо з hydro-ua як операційного API; у метаданих і UI посилаємось на офіційні сторінки meteo.gov.ua. Якщо дзеркало розійдеться з офіційним UI — пріоритет у meteo.gov.ua.

**Формати джерела (приклад полів):**
- Щоденна мережа: `id`, `post`, `river`, `lat`, `lng`, `date` (`DD.MM.YYYY`), `water_level_cm`, `baltic_system_m`, `change_per_day_m`, `water_temp_c`
- Автопости: `id`, `post`, `river`, `basin`, `lat`, `lng`, `datetime` (`DD.MM.YYYY, HH:mm`), `water_level_cm`

Часові мітки джерела **не ISO** — у нашому виході парсимо їх у ISO-8601 (див. скрипт).

---

## 2. Два шари даних: каталог vs спостереження

Щоб пізніше підключати live-оновлення, розділяємо поняття:

1. **Каталог станцій** (`stations[]`) — відносно стабільні метадані: id, назва, річка, координати, тип фіду (`daily` / `auto`), URL джерела, опційні заглушки порогів і `hostRiverOsmId`.
2. **Знімок спостережень** (`observations{ [id]: … }`) — те, що змінюється щодня / щогодини: рівень, час, температура, зміна за добу.

Один файл `public/data/hydro-posts.json` містить обидва блоки — зручно для статичного деплою. Live-фаза може:
- перезаписувати лише `observations` + `fetchedAt`, або
- віддавати observations окремим endpoint’ом з тим самим `schemaVersion`.

---

## 3. Формат файлу (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "updatedAt": "ISO",
  "fetchedAt": "ISO",
  "source": {
    "provider": "hydro-ua",
    "endpoints": ["…/hydroday.json", "…/hydroauto.json"],
    "officialUi": ["…meteo.gov.ua…"]
  },
  "bbox": { "south": 49.85, "west": 29.2, "north": 51.28, "east": 32.3 },
  "stations": [
    {
      "id": "80986",
      "nameUk": "Київ",
      "riverUk": "Дніпро",
      "lat": 50.441667,
      "lng": 30.569444,
      "kind": "auto",
      "feedKinds": ["auto", "daily"],
      "thresholdsCm": { "low": null, "normal": null, "high": null },
      "hostRiverOsmId": null,
      "sourceUrl": "https://www.meteo.gov.ua/…",
      "priorityRiver": true
    }
  ],
  "observations": {
    "80986": {
      "levelCm": 458,
      "observedAt": "2026-08-08T20:00:00.000Z",
      "tempC": null,
      "changeCm": null,
      "balticSystemM": null
    }
  }
}
```

- **`id`** — стабільний зовнішній ідентифікатор станції з hydro-ua / УкрГМЦ (рядок, напр. `"80986"`). Не вигадуємо власні id.
- **`kind`** — якщо станція є в обох фідах, пишемо `auto` (свіжіший час), `feedKinds` зберігає фактичну участь.
- **`thresholdsCm`** — заглушки під ручну курацію «низько / норма / високо» для SUP (поки не заповнюємо).
- **`hostRiverOsmId`** — опційна прив’язка до сегмента OSM (фаза 2 / SpotDetail).

Типи TypeScript: `HydroPostsDoc`, `HydroStation`, `HydroObservation` у `src/types.ts`.

---

## 4. Робочий процес збору

### Зараз (структуровано, один раз / за розкладом)

1. Запустити `npm run fetch-hydro-posts`.
2. Скрипт тягне обидва API, фільтрує за bbox (+ м’який pad для пріоритетних річок), дедуплікує за `id` (перевага auto).
3. Пише `public/data/hydro-posts.json`.
4. Фронт читає статичний файл через `useMapData` (як hazards).

### Пізніше (live auto-refresh)

1. Той самий schema: клієнт або проксі опитує source / наш endpoint.
2. Оновлює лише `observations` (+ `fetchedAt`); каталог можна оновлювати рідше.
3. **CORS:** гідро-ua / meteo.gov.ua з браузера можуть бути недоступні (cross-origin). Живе опитування краще через свій проксі / CI-артефакт, а не напряму з клієнта.
4. Не фарбувати рівні у кольори заборон — окремий шар UI.

---

## 5. Стратегія ID і курація порогів

| Крок | Що робити |
|------|-----------|
| Стабільний id | Завжди `String(row.id)` з API; не мапити на OSM-way id |
| Пріоритетні річки | Звірити наявність постів на Десні, Тетереві, Росі, Ірпені, Стугні, Трубежі, Здвижі |
| Пороги | Вручну за історією / місцевими знаннями: `thresholdsCm.low/normal/high` у см над нулем поста |
| OSM-прив’язка | Опційно `hostRiverOsmId` після snap до `water-shapes.geojson` |

Пороги **не** виводяться автоматично з одного знімка — це локальна курація.

---

## 6. Фільтр географії

Операційний bbox = `MAP_EXTENT` у `src/lib/mapExtent.ts` (північний зріз ~51.28).  
Станція потрапляє, якщо:
- координати всередині bbox, **або**
- річка з пріоритетного списку плану **і** координати в bbox ± `0.35°` (щоб не відрізати крайні пости пріоритетних річок).

**Покриття УкрГМЦ:** у знімку мережі часто **немає** окремих постів на Ірпені, Стугні, Трубежі, Здвижі — їх просто немає у `hydroday`/`hydroauto`. Десна/Тетерів/Рось/Дніпро частково покриті (поза bbox — Чернігів, Фесюри тощо потрапляють через pad). Це обмеження джерела, не фільтра мапи.

---

## 7. UI на мапі (поточний scope)

- Окремий шар «Гідропости», чекбокс у фільтрах (`Filters.showHydroPosts`).
- Маркери: відмінний стиль від hazards (бірюза / «рівень»), підпис рівня при наявності.
- Popup: назва поста, річка, рівень см, час, посилання на джерело.
- Видно в обох режимах мапи; **не** впливає на кольори обмежень.
- Zoom ≥ 9 (щоб не засмічувати дрібний огляд).

---

## 8. Що **ще не** зроблено (свідомо)

- Кольори / класи «прохідно для SUP» за порогами `thresholdsCm`.
- Deep-link у `SpotDetail` (`hydro: { stationId, url, noteUk }` з плану §3).
- Live-polling у браузері / сервісний воркер.
- Автоматичний snap `hostRiverOsmId`.
- Повний TZ-парсер для зимового/літнього часу України (скрипт використовує просте правило місяця).

---

## 9. Команди

```bash
npm run fetch-hydro-posts   # оновити public/data/hydro-posts.json
npm run build               # перевірка типів + збірка
```

Файл даних: `public/data/hydro-posts.json`  
Скрипт: `scripts/fetch-hydro-posts.mjs`
