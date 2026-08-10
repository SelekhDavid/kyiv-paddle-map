# UI roadmap: map-first · режими · мобільний

`acceptedAt`: 2026-08-10  
Фокус (підтверджено): **map-first layout**, **спростити режими/фільтри**, **мобільний досвід**.  
Контекст огляду: поточний 3-колонковий dashboard (`App.tsx` + `FilterPanel` / `SpotList` / `PaddleMap` / `SpotDetail`).

Пов’язано: [methodology-waterbody-display](./methodology-waterbody-display.md), [tech-stack-research](./tech-stack-research.md), [stack-svelte-maplibre](./stack-svelte-maplibre.md).

**Stack note:** roadmap виконується на **Svelte + MapLibre + PMTiles** (React/Leaflet знято з UI).

---

## 1. Цілі

- Карта = головний продукт; панелі — auxiliary chrome.
- ≤ **5 контролів** у першому екрані.
- Мобіль: карта на весь viewport; список/деталь — bottom sheet.
- Режими не дублюють один одного довгими поясненнями в header.

**Non-goals (поки)**
- Dark mode / glow / pill-wall «редизайн ради редизайну».
- Додавати ще dashboard-блоки (стат-стрічки, промо-картки).
- Змінювати юридичну семантику кольорів без окремого рішення продукту.

---

## 2. Locked decisions (прийнято)

| # | Рішення |
|---|---------|
| L1 | Поетапний план **P0 → P3** нижче — canonical roadmap UI |
| L2 | Default UX intent: «Правила»; «Свіжі згадки» і «Детально» — вторинні шари/chips, не рівноправна «стіна радіо» на довгій формі |
| L3 | Деталі водойми не тримають постійну порожню праву колонку — overlay / drawer / sheet лише при виборі |
| L4 | Повний legal/disclaimer — раз (info sheet / footer), не конкурує з брендом у header |
| L5 | Легенда кольорів — близько до карти; не дублювати checkbox + довгий текст у кожному режимі |

---

## 3. Поточний стан (коротко)

**Сильні**
- Колір ↔ статус у списку
- Чітке розділення `restrictions` / `paddle` / `detail`
- Типографіка Manrope + Literata, спокійний фон
- Дисклеймер про воєнний стан

**Слабкі (під фокус)**
- Карта не герой (~1/3 layout)
- FilterPanel перевантажений
- `<1100px`: довгий скрол; карта губиться
- Header `warn` конкурує з h1
- Порожній right panel завжди на місці
- Продакшен-банери з `npm run …` — не користувацькі

---

## 4. Референсні патерни

AllTrails / Outdooractive, Windy, Google Maps Explore, Organic Maps:

| Патерн | Навіщо |
|--------|--------|
| Map fullscreen + floating chrome | Географія = продукт |
| Progressive disclosure | Базові фільтри зовні, решта в «Шари» |
| Mode as chips | Компактні 2–3 інтенти |
| Legend on map | Поруч із даними |
| Detail as overlay/sheet | Не тримати empty column |
| Bottom sheet (mobile) | Список і detail поверх карти |

---

## 5. Етапи (canonical)

### P0 — структура (найвищий вплив)

- Карта на весь viewport (десктоп + мобіль)
- Floating: пошук + компактний mode control
- Detail: drawer (desktop) / sheet (mobile) **лише коли вибрано**
- Прибрати постійну праву колонку «Оберіть водойму…»
- Header → мінімальний бренд + іконка ℹ (повний warn — у sheet)

**Done when:** перший екран читається як карта з 1–2 floating controls, не як admin dashboard.

### P1 — фільтри та режими

- Default: «Правила»
- «Свіжі згадки» / «Детально» — chips / layer toggles
- Типи водойм → 3–4 chips (або «Усі» + multi)
- Контури / течія / людність / detail layers → група **«Шари карти»**
- Легенда — картка на карті

**Done when:** ≤ 5 контролів без відкритого «Шари»; легенда видима без скролу фільтрів.

### P2 — мобільний UX

- `100dvh` + safe-area
- Bottom sheet: peek → half → full (список / деталь)
- Не показувати повні фільтри + повний список одночасно з картою
- Sticky «Скинути фільтри» при 0 результатів
- Короткий on-map status strip замість стіни тексту

**Done when:** телефон: карта завжди видима; деталь відкривається жестом/тапом без втрати map context.

### P3 — поліровка взаємодії

- FlyTo / fit при виборі зі списку
- Highlight відповідного shape при hover/select
- Clustering / density на zoom-out (особливо derived)
- Skeleton / on-map loading замість банера під title
- Людські error messages (без інструкцій `npm run …` у проді)

**Done when:** map ↔ list відчуваються як один інструмент; помилки зрозумілі кінцевому користувачу.

---

## 6. Що свідомо не робити спочатку

- Нові панелі / статистика в hero
- Три повноцінні «світи кольорів» без шарової метафори
- Повний редизайн токенів без структурного P0

---

## 7. Порядок імплементації (для Agent)

1. P0 layout shell (CSS/React structure) без зміни data semantics  
2. P1 FilterPanel → chips + layers sheet  
3. P2 mobile sheet behaviour  
4. P3 map interactions + error UX  

Юридичні кольори, `mapMode` data rules і integrity Spot↔shape — за [methodology-waterbody-display](./methodology-waterbody-display.md); UI лише змінює chrome і progressive disclosure.
