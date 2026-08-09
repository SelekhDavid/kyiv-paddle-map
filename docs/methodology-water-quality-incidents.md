# Методика: якість води / купання / інциденти

`checkedAt`: 2026-08-09  
Scope: Київ + Київська область (операційний bbox мапи = `MAP_EXTENT`) + пріоритетні водні тіла з плану (Десна, Дніпро / міські пляжі, Тетерів, Рось, Ірпінь, Стугна тощо).  
Мета: **структуровано** збирати офіційні проби на купання й епізоди забруднення — **окремо** від кольорів заборон навігації та від шару гідропостів / hazards.

**Статус артефактів:** схеми й плейсхолдери готові до live-підключення; UI на мапі **відкладено** (дані вже тягнуться в `useMapData`, маркери/чекбокси — наступна фаза).

Пов’язано: [план досліджень](./plan-sup-passability-water-research.md) (§7–§9), гідропости — [methodology-hydro-posts.md](./methodology-hydro-posts.md) (та сама філософія «каталог vs спостереження»), показ водойм — [methodology-waterbody-display.md](./methodology-waterbody-display.md) (WQ/інциденти не перемальовують stroke статусу).

---

## 1. Джерела і довіра

| Джерело | Роль | Що беремо | Примітки / хуки для дослідження |
|---------|------|-----------|----------------------------------|
| **КП «Плесо»** (Київ) | Первинне для міських пляжів / купальних зон | Списки дозволених / закритих пляжів, сезонні оголошення | URL у `sources[]` реєстрі; агент заповнює конкретні сторінки в `docs/research/*` |
| **Лабораторні центри МОЗ** / філії | Проби мікробіології / хімії | Дата проби, «відповідає / не відповідає» | Часто PDF або новини — фіксуємо `sampleAt` ISO + URL |
| **МОЗ України** | Зведення, попередження | Іменні пляжі / населені пункти | Якщо лише пляж — не поширюємо на всю річку (див. §5) |
| **Держпродспоживслужба** (обласна / міська) | Офіційні заборони купання | Рішення / оголошення | Пріоритет над НГО для `status` |
| **Дашборди / відкриті дані області** | Дублікати сигналів | Дата, зона | Використовувати як дзеркало з посиланням на первинне |
| **Інциденти (новини, ДСНС, еко-НГО)** | Епізоди забруднення | Гео / водойма, період, статус | Окремий файл `water-incidents.json` |
| **Громадський / НГО моніторинг** | Додатковий сигнал | Разові проби | `confidence: low`; **не** перебиває офіційну пробу |

**Пріоритет при конфлікті:** активний інцидент (`unsafe`) → остання офіційна проба Держпродспоживслужба / МОЗ / Плесо → лабцентри → НГО.

**Не змішувати:**
- якість води / купання ↔ юридична заборона навігації (`classification` / `local-rules`);
- якість води ↔ рівень води (гідропости);
- інциденти ↔ точкові OSM-перешкоди (`river-hazards.json`).

---

## 2. Два шари даних: каталог vs спостереження

Як у гідропостах:

1. **Каталог точок проб** (`sampleSites[]`) — відносно стабільні метадані: стабільний `id`, назва, координати або прив’язка до `spotId` / `waterBody`, тип зони (пляж / водне тіло), URL джерел, регіон.
2. **Знімок спостережень** (`observations{ [id]: … }`) — те, що змінюється за сезоном / тижнем: `status`, `sampledAt`, метрики / нотатки, джерела конкретної проби.

Окремо (не змішувати з каталогом проб):

3. **Інциденти** (`water-incidents.json` → `incidents[]`) — епізоди з початком/кінцем, severity, `active` / `resolved`. Живуть у **окремому** файлі, щоб polling інцидентів не перезаписував каталог пляжів.

Один `water-quality.json` містить каталог + observations (зручно для статичного деплою). Live-фаза може:
- перезаписувати лише `observations` + `fetchedAt` / `updatedAt`, або
- віддавати observations окремим endpoint’ом з тим самим `schemaVersion`.

---

## 3. Формат `water-quality.json` (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "updatedAt": "ISO",
  "fetchedAt": null,
  "bbox": { "south": 49.85, "west": 29.2, "north": 51.28, "east": 32.3 },
  "sources": [
    {
      "id": "pleso",
      "nameUk": "КП «Плесо»",
      "role": "bathing_sites",
      "urls": [],
      "noteUk": "Хук: заповнити актуальні URL після research."
    }
  ],
  "sampleSites": [
    {
      "id": "wq-trukhaniv",
      "nameUk": "Труханів острів (пляж)",
      "lat": 50.4605,
      "lng": 30.535,
      "kind": "beach",
      "spotId": "trukhaniv",
      "waterBodyUk": "Дніпро",
      "hostRiverOsmId": null,
      "regionUk": "Київ",
      "sourceIds": ["pleso"],
      "placeholder": true
    }
  ],
  "observations": {
    "wq-trukhaniv": {
      "status": "unknown",
      "labelUk": null,
      "sampledAt": null,
      "metricsNoteUk": null,
      "confidence": null,
      "sourceUrls": [],
      "placeholder": true
    }
  },
  "byRiverNameToken": {}
}
```

| Поле | Зміст |
|------|--------|
| `sampleSites[].id` | Стабільний id (`wq-…`); не змінювати між знімками |
| `spotId` | Опційний зв’язок із curated `spots.json` |
| `observations[id].status` | `ok` \| `advisory` \| `unsafe` \| `unknown` |
| `byRiverNameToken` | Хук під іменовані річки (план): `{ [token]: { status, … } }` — поки порожній об’єкт |

Типи: `WaterQualityDoc`, `WaterSampleSite`, `WaterQualityObservation` у `src/types.ts`.

---

## 4. Формат `water-incidents.json` (`schemaVersion: 1`)

```json
{
  "schemaVersion": 1,
  "updatedAt": "ISO",
  "fetchedAt": null,
  "bbox": { "south": 49.85, "west": 29.2, "north": 51.28, "east": 32.3 },
  "sources": [],
  "incidents": [
    {
      "id": "inc-desna-example",
      "titleUk": "…",
      "severity": "high",
      "status": "resolved",
      "startedAt": "ISO|null",
      "endedAt": "ISO|null",
      "lat": null,
      "lng": null,
      "waterBodyUk": "Десна",
      "spotIds": [],
      "sampleSiteIds": [],
      "hostRiverOsmId": null,
      "summaryUk": null,
      "sourceUrls": [],
      "placeholder": true
    }
  ]
}
```

- Гео: або `lat`/`lng`, або лише `waterBodyUk` / `spotIds` / `hostRiverOsmId` (агент research доповнить).
- `severity`: `low` \| `medium` \| `high` \| `critical`.
- `status`: `active` \| `resolved` (майбутнє: `monitoring`).
- Активний інцидент → у UI (пізніше) `unsafe` + банер; після `resolved` — не форсити `unsafe` без нової проби.

Типи: `WaterIncidentsDoc`, `WaterIncident`.

---

## 5. Правила мапінгу на spots / річки

1. Проба з іменним пляжем → observation для `sampleSite`; у SpotDetail (майбутнє) — бейдж чистоти лише для пов’язаного `spotId`.
2. МОЗ: «пляж X не відповідає» → `advisory`/`unsafe` **лише** для пляжу X, `metricsNoteUk` на кшталт «стосується пляжу X».
3. Інцидент на річці (Десна / Сейм…) → запис у `incidents[]`; опційно дублювати сигнал у `byRiverNameToken` або спостереженнях пов’язаних site ids — **не** перемальовувати колір лінії.
4. Відсутня проба → `unknown` / `null` поля; порожній каталог краще за вигадані статуси.

---

## 6. Робочий процес збору

### Зараз (плейсхолдери + ручна курація)

1. Каталог `sampleSites` / шаблон `incidents` живе в `public/data/*.json` з `"placeholder": true`.
2. Research-агенти додають URL і факти в `docs/research/*` (не видаляти чужі нотатки).
3. Куратор або майбутній `scripts/scrape-water-quality.mjs` заповнює `observations` і знімає `placeholder` там, де є живі дані.
4. Фронт читає файли через `useMapData` (як hazards / hydro) — порожні масиви безпечні.

### Пізніше (live auto-refresh)

1. Той самий `schemaVersion`: CI або проксі оновлює `observations` (+ `fetchedAt`) і/або список активних `incidents`.
2. Каталог `sampleSites` оновлювати рідше за спостереження.
3. **CORS:** сайти Плесо / МОЗ часто без CORS — живе опитування з браузера ненадійне; краще статичний артефакт з CI або власний проксі.
4. Polling інтервал (орієнтир): проби купання — раз на день у сезон; інциденти — частіше (години), поки `status: active`.

---

## 7. ID і геофільтр

| Крок | Правило |
|------|---------|
| Sample site id | Префікс `wq-` + стабільний slug (`wq-trukhaniv`); не перейменовувати |
| Incident id | Префікс `inc-` + slug року/події (`inc-desna-2024-pollution`) |
| Зовнішні id | Якщо з’явиться офіційний код пляжу — додати `externalIds`, не ламати наш `id` |
| Bbox | Як `MAP_EXTENT`; точки поза bbox — лише якщо пріоритетна водойма й research явно вимагає |

---

## 8. UI на мапі (свідомо відкладено)

- Дані вже доступні з хука: `waterQuality`, `waterIncidents`.
- Чекбокси / маркери / бейджі SpotDetail — **наступна фаза**; не змішувати з hydro / hazards.
- Колір ліній і маркерів заборон **не** змінюється від `waterQuality.status`.

---

## 9. Що плейсхолдер, а що live

| Елемент | Зараз |
|---------|--------|
| `schemaVersion`, структура полів | **Live-ready** (стабільна схема) |
| `sources[]` реєстр | Плесо / GIS / ЦКПХ / ЦГЗ (phc) / ОЦКПХ / dpssko заповнені; dpss = low-value note |
| `sampleSites[]` | 15 `pleso-*` + stub `wq-desna-mouth` + oblast (Чайка / Переяслав / Біла Церква) + `wq-irpin-river`; `catalog` ≠ lab |
| `observations.*` | ЦГЗ 06.08.2026 named + ЦКПХ chem dims + Плесо micro; `advisory` Вербний + Пуща |
| `byRiverNameToken` | Partial: десна / ірпінь / рось / тетерів / дніпро (`unknown` placeholders) |
| `incidents[]` | 9 curated research examples (`docs/research/water-incidents.*`); `placeholder: false` де повна документація, `true` де гео/lifecycle ще неповні |
| `fetchedAt` | `null` до першого реального scrape (кураторський snapshot ≠ live poll) |
| Скрипт scrape / CI | Ще немає |
| UI шар | Відкладено |

Коли з’являються реальні дані: виставити ISO-часи, заповнити `sourceUrls`, **прибрати або поставити `placeholder: false`** лише для записів із перевіреним джерелом.

---

## 10. Файли

| Шлях | Призначення |
|------|-------------|
| `public/data/water-quality.json` | Каталог проб + observations |
| `public/data/water-incidents.json` | Інциденти |
| `src/types.ts` | TypeScript типи |
| `src/hooks/useMapData.ts` | Завантаження (empty-safe) |
| `docs/research/*` | Нотатки агентів (не чіпати чужі) |

---

## Research sync

`public/data/water-incidents.json` був заповнений з кураторського знімка [`docs/research/water-incidents.md`](./research/water-incidents.md) (+ [`water-incidents.json`](./research/water-incidents.json), `checkedAt` 2026-08-09): 9 прикладів (ДЕІ / ДСНС / Міндовкілля / Плесо-релеї / media), реєстр `sources[]` з URL. `fetchedAt` лишається `null` — це **не** live poll, а статичний curated snapshot до появи scrape/CI. Сезонні / recurring патерни й чутки без лабораторії мапляться в `status: "monitoring"` (схема не має `unconfirmed`); `placeholder: true` лише де гео або lifecycle ще неповні. UI шару інцидентів і `water-quality` sample sites — поза цим sync.

**Плесо / муніципальні пляжі:** `public/data/water-quality.json` synced з [`docs/research/pleso-bathing.md`](./research/pleso-bathing.md) (+ `municipal-beaches-snapshot.json`, `pleso-water-quality-snapshot.json`, `pleso-spots-matching.json`, зріз 2026-08-08/09). 15 `pleso-*` sampleSites з GIS coords/`catalog.canBatheFlag`; lab у `observations{}` окремо (ЦКПХ named + Плесо micro aggregate). Strong spot matches only у `spotIds`.

**МОЗ / ЦГЗ / ЦКПХ / oblast:** upsert з [`docs/research/water-quality-bathing-safety.md`](./research/water-quality-bathing-safety.md) (+ [`water-quality-snapshot.json`](./research/water-quality-snapshot.json), `checkedAt` 2026-08-09) **без** заміни `pleso-*` каталогу. Precedence: ЦКПХ table/named chem/micro → ЦГЗ weekly named list → Плесо bulk. Додано Чайка (Рось) OK, Переяслав / Біла Церква unknown, `wq-irpin-river` + Desna stub; `sources` phc.org.ua / kyiv.cdc.gov.ua / kv.cdc.gov.ua / dpssko. Optional `dims` / `publishedAt` / `sourceKind` на observations (backward compatible).
