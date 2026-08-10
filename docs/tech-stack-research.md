# Дослідження стеку: платформа · мова · дані («база»)

`checkedAt`: 2026-08-10  
Продукт: мапа водойм Київщини для SUP / плавання (контури OSM, статуси заборон, paddle-сигнали, detail layers).  
Поточний стек: **Vite + React + TypeScript + Leaflet**, дані = **статичні JSON/GeoJSON** у `public/data/`, хостинг = **GitHub Pages**.

Пов’язано: [ui-roadmap](./ui-roadmap.md), [methodology-waterbody-display](./methodology-waterbody-display.md).

Мета документа: зафіксувати **рекомендацію «що тримати / що міняти / коли рости»**, а не загальний «кращий стек у світі».

> **Update 2026-08-10:** продукт прийняв greenfield path **Svelte + MapLibre + PMTiles** (shell). Див. [stack-svelte-maplibre](./stack-svelte-maplibre.md). Нижчі розділи зберігають порівняльну аргументацію; locked T1/T2/map engine superseded for UI.

---

## 1. Контекст продукту (критерії вибору)

| Критерій | Значення для цього проєкту |
|----------|----------------------------|
| Аудиторія | Мобільний first; веб достатньо |
| Дані | Переважно **read-only** для клієнта; оновлення batch (scrape / Overpass / curation) |
| Геометрія | Контури області вже **~8 MB GeoJSON** (`water-shapes.geojson`) — це межа комфорту «однакові download + Leaflet parse» |
| Команда | Мала / соло; цінність простоти пайплайна |
| Хостинг | Зараз безкоштовний статичний; backend = вартість + ops |
| Юридичний шар | Важлива прозорість джерел; не real-time GIS enterprise |
| Auth / multi-user edit | Поки **немає** |

**Висновок критеріїв:** виграє **тонкий клієнт + підготовлені файли/тайли**, а не рання БД і не нативний мобільний rewrite.

---

## 2. Платформа (де живе продукт)

### Кандидати

| Платформа | Плюси | Мінуси | Вердикт |
|-----------|-------|--------|---------|
| **Web SPA (PWA)** | Один код, shareable URL, швидкі ітерації UI, GitHub Pages / CF Pages | Офлайн і «як у сторі» слабші без PWA-зусиль | **Рекомендовано зараз** |
| Capacitor / TWA (обгортка SPA) | «Додаток» у сторі без rewrite | Окремий релізний цикл, іконки, review | Опційно **після** стабільного web |
| React Native / Flutter | Нативний UX | Дублікат мап-стеку, дорогий rewrite Leaflet/MapLibre | **Не зараз** |
| SSR (Next/Nuxt) | SEO лендінгу | Мапа все одно client-heavy; зайва складність для tool-app | Лише якщо з’явиться окремий marketing site |
| Pure static HTML без React | Мінімум deps | Складно тягнути поточні режими/фільтри/detail | Занадто пізно; investment уже в React |

### Рекомендація: платформа

1. **Залишити Web SPA** як primary.
2. У рамках UI P0–P2 зробити layout **mobile-first** (див. ui-roadmap).
3. Пізніше: **PWA** (manifest + service worker для shell + кеш JSON) — дешевше за натив.
4. Store-обгортка — тільки якщо з’явиться попит «встановити з App Store», не як умова запуску.

**Хостинг (платформа доставки)**

| | Коли |
|--|------|
| **GitHub Pages** (поточне) | OK для MVP; увага до `base`, `.nojekyll`, лімітів великого GeoJSON |
| **Cloudflare Pages / Netlify** | Кращий CDN + простіші preview; варто при болях Pages |
| Vercel + API routes | Коли з’являться серверні scrape-cron / secrets |
| Власний VPS + nginx | Коли потрібні postgis/tileserver і повний контроль |

---

## 3. Мова і UI-фреймворк

### Кандидати мови

| Мова | Роль | Вердикт |
|------|------|---------|
| **TypeScript** | UI + більшість скриптів пайплайна | **Так — канон** |
| JavaScript (без типів) | Швидше писати одноразові `.mjs` | Допустимо для scrape-скриптів (як зараз) |
| Python | GIS ETL, pandas, raster/width research | **Так для research/ETL**, не для UI |
| Rust/Go | Tile servers, high-load APIs | Overkill до появи серверного навантаження |
| Kotlin/Swift | Натив | Не зараз |

### Кандидати UI

| Стек | Плюси | Мінуси | Вердикт |
|------|-------|--------|---------|
| **React + Vite** (поточне) | Вже весь продукт, екосистема, легко найняти знання | Bundle/map perf треба пильнувати | **Залишити** |
| Solid / Svelte | Менший runtime | Rewrite без вигоди для мапи | Ні |
| Vue | Паритет React | Rewrite | Ні |
| MapLibre + vanilla | Менше React glue | Важче структурувати panels/sheets | Ні як повний rewrite |

### Рекомендація: мова

- **TypeScript + React + Vite** — залишити.
- Скрипти генерації даних: **Node `.mjs`** (як зараз) + **Python** лише там, де вже є research (`docs/research`).
- Не міняти мову/фреймворк заради UI roadmap — roadmap = layout/chrome, не rewrite.

---

## 4. Мап-рушій (частина «платформи відображення»)

Це окремо від React: саме тут болить великий GeoJSON.

| Рушій | Плюси | Мінуси | Коли |
|-------|-------|--------|------|
| **Leaflet** (поточне) | Просто, зрілий UX, react-leaflet | Важко з великими polygon layers; CPU на main thread | OK поки контури off by default / спрощені |
| **MapLibre GL JS** | GPU, vector tiles, плавний pan/zoom, сучасний look | Інший API; міграція стилів/шарів | **Наступний крок перфу**, якщо «повні контури» мають бути first-class |
| OpenLayers | Потужний GIS | Важчий DX для product UI | Ні |
| Mapbox GL (proprietary) | Зручно | Ліцензія/токен | Уникати, якщо MapLibre покриває |

### Рекомендація: map engine

- **Коротко:** лишати Leaflet, паралельно **спростити/нарізати** `water-shapes` (див. розділ 5).
- **Середньо:** якщо map-first UX вимагає завжди видимих контурів — мігрувати water layer на **MapLibre + PMTiles/MVT**.
- React може лишитися; змінюється лише map component.

---

## 5. «База даних» і доставка геоданих

У цьому продукті «база» = **де живе джерело правди і як клієнт його читає**, не обов’язково Postgres.

### Моделі

| Модель | Опис | Плюси | Мінуси |
|--------|------|-------|--------|
| **A. Static files** (поточне) | `spots.json`, `classification.json`, GeoJSON у Pages | Нульовий ops, git-reviewable, ідеально для curation | Великі файли; немає просторового SQL; важко «query bbox» |
| **B. Static + vector tiles** | Tippecanoe / planetiler → **PMTiles** або `{z}/{x}/{y}.pbf` на CDN | Швидка карта; viewport load; лишається git/CDN | Потрібен build step; складніше debug ніж JSON |
| **C. SQLite / DuckDB у CI** | Локальна аналітика, QA coords, fusion width | Зручно пайплайну; файл у репо або artifact | Не обов’язково expose клієнту |
| **D. PostGIS** | Просторовий SQL, ST_AsMVT live, складні joins | Свіжий query API, scale | Сервер, бекапи, вартість; зайве без multi-writer |
| **E. Hosted SaaS** (Supabase/Firebase + Geo) | Auth, realtime | Vendor lock, дорожче ніж треба | Коли з’являться акаунти/UGC |

### Поріг «коли GeoJSON вже ні»

Індустрійне правило (MapLibre/GIS perf guides): GeoJSON комфортний для **малих** шарів (сотні–низькі тисячі простих фіч, сотні KB–низькі MB). Далі — **vector tiles**.  
У вас `water-shapes.geojson` ≈ **8 MB** і вже показував проблеми на Pages/клієнті → шар контурів **перетиснув** модель A.

### Рекомендація: дані / «база»

**Зараз (залишити + підкрутити)**

| Шар | Формат | Чому |
|-----|--------|------|
| Curated spots, rules, classification, WQ, incidents | **JSON** (static) | Малі, смислові, зручно review у PR |
| River widths by osmId | **JSON** object map | Lookup O(1), не геометрія |
| Water body outlines | **Проблема** | Залишити генерацію з Overpass, але: |

**Найближче покращення (без PostGIS)**

1. Build-time: спростити геометрію (Douglas-Peucker / `mapshaper` / tippecanoe) → менший payload.
2. Або згенерувати **PMTiles** з shapes і віддавати з Pages/R2; клієнт — MapLibre.
3. Тримати **source GeoJSON у CI artifact / git-LFS / release**, а в `public/` — лише tiles або simplified subset.
4. Для QA/скриптів — опційний **SQLite** (spots + osmId + lat/lng), не обов’язково в браузері.

**Коли справді брати PostGIS**

- Потрібен публічний API «дай водойми в bbox + фільтр»
- Багато редакторів / moderated UGC
- Live tiles від динамічних даних частіше ніж раз на день
- Аналітика просторових запитів поза статичним пайплайном

До того PostGIS = інфраструктура заради інфраструктури.

### «Яка база найкраща» — коротка відповідь

Для **цього** продукту найкраща «база» сьогодні:

> **Git як system of record для curated JSON + generated artifacts; CDN для роздачі; vector tiles (PMTiles) для важкої геометрії; PostGIS — лише на етапі API/редагування.**

Не Mongo «бо JSON», не Firebase «бо зручно», не повний PostGIS «бо GIS».

---

## 6. Порівняльна матриця (decision snapshot)

| Шар | Залишити | Розглянути далі | Уникати зараз |
|-----|----------|-----------------|---------------|
| Платформа продукту | Web SPA (+ потім PWA) | Capacitor | Flutter/RN rewrite |
| Хостинг | GitHub Pages | Cloudflare Pages | Дорогий always-on без потреби |
| Мова UI | TypeScript + React | — | Зміна фреймворка |
| ETL | Node + інколи Python | SQLite у CI | Enterprise GIS stack |
| Map UI | Leaflet | MapLibre + PMTiles | Mapbox paid without need |
| Дані смислу | Static JSON | Тонкий read API пізніше | Realtime DB |
| Важка геометрія | Simplified GeoJSON short-term | **PMTiles / MVT** | Сирий 8MB+ у main bundle path |
| Серверна БД | Немає | PostGIS при API/UGC | Ранній Postgres «на всяк» |

---

## 7. Рекомендована траєкторія (узгоджено з UI roadmap)

| Фаза | Стек-дія | Навіщо |
|------|----------|--------|
| **Зараз + UI P0–P1** | Не міняти React/TS/Leaflet; поправити доставку shapes (simplify / не блокувати UI) | Map-first UX не вимагає rewrite мови |
| **Паралельно з perf-болями** | Tippecanoe → PMTiles; оцінити MapLibre для water layer | Прибрати 8MB main-thread hit |
| **Після стабільного UX** | PWA cache для JSON shell | Мобільний офлайн-ish |
| **Якщо з’явиться API/редактори** | Cloudflare Worker / маленький API + (тоді) PostGIS або SQLite на edge | Реальна нужда в query/write |

---

## 8. Locked recommendations (прийняти як default)

| ID | Рішення |
|----|---------|
| T1 | Платформа: **Web SPA** (React), не нативний rewrite |
| T2 | Мова: **TypeScript** у продукті; Node/Python у пайплайні |
| T3 | «База» клієнта: **static JSON** для смислових шарів |
| T4 | Важка геометрія: план на **vector tiles (PMTiles/MVT)**, не сирий великий GeoJSON forever |
| T5 | PostGIS / hosted DB — **свідомий наступний етап**, не default |
| T6 | Зміна map engine (Leaflet → MapLibre) допустима **заради tiles/perf**, не заради «моднішого стеку» |

---

## 9. Відкриті питання (коли переглядати)

- Чи «повні контури» стають default у map-first UX? → якщо так, T4/T6 пріоритетніші.
- Чи потрібен cron оновлення заборон без ручного `npm run scrape-bans`? → з’являється мінімальний backend.
- Чи потрібні акаунти / UGC tip «я тут плавав»? → тоді auth + write store (Supabase/SQLite/PostGIS на вибір).
