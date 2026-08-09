# Дослідження: КП «Плесо» для Kyiv paddle/swim map

Дата зрізу: **2026-08-08/09** (локальний час користувача 09.08.2026).  
Мета: зібрати офіційні джерела, поля, поточні статуси купання/води, scrape-feasibility і відповідність `public/data/spots.json`. UI не змінювався.

## Sources (з URL)

| Джерело | URL | Що дає |
| --- | --- | --- |
| Сайт КП «Плесо» | https://pleso.kyiv.ua/ | Новини, лабораторія, локації (політика), рівень води, лічильники «15 пляжів» |
| Локації / критерії пляжів | http://pleso.kyiv.ua/локації/ | Відмінність «офіційний vs дикий», нормативи МОЗ/ДСНС; **немає таблиці 15 пляжів** |
| Лабораторія | http://pleso.kyiv.ua/лабораторія/ | Опис послуг/показників; **немає live API проб** |
| WP REST (новини Плесо) | `https://pleso.kyiv.ua/wp-json/wp/v2/posts` | Структуровані пости (title/date/html content) |
| Портал даних Києва — dataset | https://data.kyivcity.gov.ua/dataset/perelik-munitsypalnykh-pliazhiv-kyieva-dep-ecology | Open Data, ресурc `municipalBeaches` |
| Дашборд пляжів | https://data.kyivcity.gov.ua/dashboard/munitsypalni-pliazhi-kyieva | UI поверх того ж GeoJSON; заявлено «дані КП «Плесо»» |
| ArcGIS GeoJSON API (live) | `https://gis.kyivcity.gov.ua/api/rest/services/Пляжі_та_зони_відпочинку/MapServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&f=geojson` | **15 Point features**: ім’я, coords, водойма, `beachstatus`, інфраструктура |
| Google My Maps (карта локацій) | https://www.google.com/maps/d/u/1/viewer?mid=1gVggp5omHDw6VqYoXTO0vPH5tjnuWWY | Маршрутизація; KML export майже порожній (шар без даних / захист) |
| ЦКПХ Київ (якість води) | https://kyiv.cdc.gov.ua/news/yakist-vody-na-kyyivskyh-plyazhah-aktualna-informatsiya/ | Per-beach named list (13–14.07.2026) |
| КМДА / Портал Києва | https://kyivcity.gov.ua/news/sanitarno-mikrobiologichni_pokazniki_vodi_na_munitsipalnikh_plyazhakh_kiyeva_vidpovidayut_normi__pleso/ | Переказ Плесо: проби **04.08.2026**, усі мікро OK |
| Facebook (соц.) | https://www.facebook.com/plesokyiv/ | Дублі новин; scrape поганий |

Secondary (агрегатори): [kyivsmartcity.com огляд 15 пляжів](https://kyivsmartcity.com/de-kupatysia-v-kyievi-2026-status-15-pliazhiv-iakist-vody-i-pravyla/) — зручна таблиця на базі ЦКПХ 13–14.07, не primary.

## Fields available

### A. GeoJSON `municipalBeaches` (найкраще для live refresh інфраструктури)

Збережено: `docs/research/municipal-beaches.geojson`, нормалізований зріз `municipal-beaches-snapshot.json`, schema `municipal-beaches-layer-meta.json`.

| Field | Alias (UA) | Type / domain |
| --- | --- | --- |
| `name` | Повна назва закладку/пляжу | string |
| `district` | Район | string (**інколи помилковий**, див. caveats) |
| `waterobject` | Назва водойми | string |
| `worktime` | Режим роботи | string / null (`Цілодобово (окрім часу повітряної тривоги)` у більшості) |
| `beachstatus` | **Чи можна купатись** | 0=Ні, 1=Так |
| `geometry` / `point_x`/`point_y` | координати | WGS84; **alias lat/lon у метаданих переплутані** — `point_x≈30` (lng), `point_y≈50` (lat); використовувати GeoJSON `coordinates:[lng,lat]` |
| Amenities (0/1) | душ, рятувальний пост, питний фонтан, пологий вхід, зупинка ГТ, спорт/дитячі майданчики, роздягальні, тіньові навіси, WC, wifi, accessibility/ramp тощо | smallint |
| `tel`, `web`, `globalid`, `last_editeddate` | контакти / id / epoch ms | |

**Немає в API:** дата проби, мікро/хім показники (E.coli, ентерококи), прапор «сезон відкрито», укриття, PDF-таблиці лабораторії.

### B. Новини Плесо / КМДА / ЦКПХ

- Зазвичай **агреговані** («усі мікро в нормі») без CSV.
- ЦКПХ інколи дає **іменований список** OK / відхилення.
- Дата забору vs дата публікації — різні; треба зберігати обидві.

## Current snapshot summary

### Муніципальні пляжі (GIS, зріз 2026-08-08)

**15 / 15** features, усі з `beachstatus=1` («можна купатись» у каталозі ІАС).

| # | Пляж | Водойма (GIS) | ≈ coords |
| --- | --- | --- | --- |
| 1 | Венеція | Венеціанська протока, острів Долобецький | 50.449, 30.575 |
| 2 | Вербний | озеро Вербне | 50.491, 30.514 |
| 3 | Веселка | Русанівська протока | 50.455, 30.582 |
| 4 | Галерний | затока Галерна | 50.370, 30.551 |
| 5 | Дитячий | Венеціанська протока, острів Венеціанський | 50.447, 30.572 |
| 6 | Золотий | р. Дніпро, острів Венеціанський | 50.431, 30.581 |
| 7 | Молодіжний | р. Десенка, острів Долобецький | 50.451, 30.570 |
| 8 | Острів Оболонський | затока Наталка та р. Дніпро | 50.509, 30.519 |
| 9 | Передмістна Слобідка | р. Дніпро, острів Венеціанський | 50.438, 30.571 |
| 10 | Пуща-Водиця | ставок Горащиха (Котурка, 8 лінія) | 50.540, 30.345 |
| 11 | Райдуга | озеро Райдуга | 50.486, 30.580 |
| 12 | Тельбін | озеро Тельбін | 50.427, 30.604 |
| 13 | Троєщина | затока р. Десенка | 50.505, 30.567 |
| 14 | Центральний | річка Дніпро | 50.459, 30.533 |
| 15 | Чорторий | р. Дніпро | 50.496, 30.534 |

Інфра-сигнали зі зрізу (не повний аудит): рятувальний пост `safeguard=1` майже всюди, але **0** у «Чорторий» і «Золотий» у цьому експорті — перевіряти перед UI-твердженнями.

### Якість води (лабораторні)

| Дата проб | Джерело | Підсумок |
| --- | --- | --- |
| **13–14.07.2026** | ЦКПХ | **13 OK / 2 хімічні відхилення**: оз. Вербне, ставок Гаращиха (Пуща-Водиця) |
| ~липень (пост 24.07) | Плесо | Усі **мікро** в нормі, без per-beach |
| **04.08.2026** | Плесо → КМДА (07.08) | Усі **мікро** в нормі, без per-beach; **найновіше** офіційне на дату зрізу |

Деталі: `pleso-water-quality-snapshot.json`.

### Сезон / безпека

- Офіційний сезон **не відкритий**.
- Пляжі обслуговуються (прибирання, буї, лайфгарди — за публічними заявами).
- Немає капітальних укриттів на пляжах → евакуація при тривозі.

## Match до `spots.json`

Повний JSON: `pleso-spots-matching.json`.

**Strong:** Тельбін→`telbin`; Центральний→`trukhaniv`; Венеція/Дитячий/Молодіжний/Передмістна→`hydropark`.

**Partial:** Золотий, Веселка→`hydropark`; Пуща-Водиця→`blakytne`/`redkyne` (інша водойма, той район).

**Weak / name traps:** Троєщина≠`sonyachne`; Острів Оболонський≠`sobachne`; Галерний **не** збігається з `koncha-zaspa` за координатами (~8 км).

**Немає spot:** Райдуга (≠`radunka`!), Вербний, Чорторий; також більшість озер/кар’єрів Київщини поза муніципальним списком.

## Scrape-friendliness & live-update

| Канал | Friendly? | CORS | Рекомендація |
| --- | --- | --- | --- |
| ArcGIS GeoJSON пляжів | **Висока** | `Access-Control-Allow-Origin` відповідає Origin (перевірено з `https://example.com`) | Primary для coords + infra + catalog `beachstatus`. User-Agent бажаний (без UA — інколи CF HTML). |
| CKAN package_show | Висока | CKAN API | Meta / URL discovery |
| Плесо WP REST | Середня | типово ok | Poll + keyword filter (`вода`, `пляж`, `санітарно`) → парсити HTML content; немає стабільної schema статусів |
| Плесо HTML / локації | Низька для статусів | n/a | Немає таблиці якості |
| ЦКПХ новини | Середня/низька | site HTML | Немає стабільного open API проб; REST search у нас дав помилку |
| Google My Maps | Низька | — | KML без переліку |
| Facebook | Низька | — | Лише як alert channel |
| PDF лабораторних листів | Низька | — | Бюджетні обґрунтування матеріалів тестів, не статуси |

**Висновок:** live infra refresh — **реалістичний** через GeoJSON. Live «можна купатися за пробою» — **лише semi-auto** (парсинг новин Плесо/ЦКПХ/КМДА) або ручний weekly ingest, доки немає відкритого lab API.

## Recommended data shape (пізніше)

```json
{
  "meta": {
    "refreshedAt": "ISO-8601",
    "officialSeasonOpen": false,
    "sources": [{ "id": "...", "url": "...", "fetchedAt": "..." }]
  },
  "beaches": [
    {
      "id": "pleso-telbin",
      "gisGlobalId": "{…}",
      "nameUk": "Тельбін",
      "aliases": ["Озеро Тельбін"],
      "lat": 50.4274,
      "lng": 30.6038,
      "district": "Дніпровський",
      "waterObject": "озеро Тельбін",
      "spotIds": ["telbin"],
      "catalog": {
        "canBatheFlag": true,
        "flagSource": "gis.beachstatus",
        "flagUpdatedAt": "2025-06-20T05:00:00Z"
      },
      "lab": {
        "microStatus": "ok|fail|unknown",
        "chemStatus": "ok|fail|unknown",
        "sampledAt": "2026-08-04",
        "publishedAt": "2026-08-07",
        "authority": "pleso|cdc",
        "sourceUrl": "…"
      },
      "amenities": { "lifeguard": true, "shower": true, "wc": true }
    }
  ]
}
```

Правила merge: **не** підміняти `lab.*` значенням `catalog.canBatheFlag`; показувати обидва + дату проби.

## Caveats

1. **Сезонність / воєнний стан:** «не відкрито» ≠ «пляжі не працюють» ≠ «вода погана». Три окремі осі.
2. **Дві лабораторії, різні дати:** Плесо і ЦКПХ чергуються; після зливи статуси стрибають. Заголовок без дати забору — сміття.
3. **`beachstatus` застарів/каталоговий:** усі 15 = 1 при тому, що ЦКПХ 13.07 фіксував хімічні відхилення на 2 локаціях; `last_editeddate` часто червень **2025**.
4. **Якість GIS-атрибутів:** район Тельбіна/Вербного може бути неправильним; alias lat/lon swapped; «Горащиха» ≈ «Гаращиха».
5. **Trust:** пресрелізи Плесо/КМДА — OK для мікро-агрегату; для per-beach краще ЦКПХ або стенди на пляжі. Соцмережі/SEO-сайти — тільки як вказівник на першоджерело.
6. **Paddle ≠ swim:** офіційний пляж ≠ дозвіл на SUP; правила навігації — окремий шар (КОДА/місто), поза цим дослідженням.

## Файли, записані в репозиторій

| Path | Зміст |
| --- | --- |
| `docs/research/pleso-bathing.md` | цей звіт |
| `docs/research/municipal-beaches.geojson` | сирий ArcGIS GeoJSON (15 features) |
| `docs/research/municipal-beaches-snapshot.json` | нормалізований зріз + field list |
| `docs/research/municipal-beaches-layer-meta.json` | ArcGIS layer schema |
| `docs/research/pleso-water-quality-snapshot.json` | зведений статус проб (липень–серпень 2026) |
| `docs/research/pleso-spots-matching.json` | matches / mismatches зі `spots.json` |
| `docs/research/pleso-2026-07-24-water.json` | WP post Плесо про мікро |
| `docs/research/pleso-wp-latest-posts.json` | останні пости |
| `docs/research/pleso-wp-monitoring-posts.json` | пошук «моніторинг» |
| `docs/research/pleso-wp-water-2026.json` | пошук «вода» 2026 |

Допоміжний скрипт `docs/research/_parse-beaches.mjs` можна перевикористати для наступного зрізу.
