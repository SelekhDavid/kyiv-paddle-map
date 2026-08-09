# Клубні / комерційні джерела після 2022 (пункт 1)

`checkedAt`: 2026-08-08  
`minReportYear`: **2023** (все старше відсікається в режимі «де поплавати»)

## Критерії для карти

1. Лише водойми з **зеленим** (`likely_ok`, `check_local`) або **жовтим** (`restricted`, `oblast_ban`) статусом.
2. Червоні (`banned_navigation`, каскад Дніпра) **не показуються**, навіть якщо є тури/прокат.
3. Джерело враховується лише з `year ≥ 2023`.

## Хаби, які скрейпили / переглядали

| Джерело | URL | Що знайшли ≥2023 |
|---------|-----|------------------|
| Kuluar | kuluarpohod.com | Десна, Рось, Ірша+Тетерів — дати 2025–2026 |
| Active Rest | active-rest.ua | Десна, Тетерів, Рось, Любич, Козинка, Тельбін — календар 2026 |
| Lost World | lostworld.com.ua | Десна, Любич, Козинка, Ірпінь SUP — сезон 2026 |
| Sapaequip | sapaequip.com | Ірпінь «Високий берег» 2026; Лебедівка (часто червона зона — не мапимо) |
| SUP PORT | sup-port.kyiv.ua | Тельбін, Пуща/Горащиха — сторінки 2025 |
| Kayak Center | kayakcenter.kyiv.ua | Тягле (тимчасово закрито); багато точок на Дніпрі — червоні |
| 4 сторони | pohod.org.ua | Десна, Тетерів |
| Дикий Тур | wildtour.com.ua | Рось, Ірпінь |
| Poєзднік | poezdnik.kiev.ua | **Тетерів 2024** (Заставський) |
| Threads | threads.net | Публічний пошук «Тельбін SUP» / «SUP Київ» — **No results** (логінволл) |

## Покриття (підсумок для зелених/жовтих)

| Водойма | Вердикт | Ключові актуальні джерела |
|---------|---------|---------------------------|
| Десна | ok | Kuluar, Active Rest, Lost World, 4 сторони |
| Тетерів | ok | Active Rest, Kuluar, 4 сторони, Poєзднік 2024 |
| Рось | ok | Kuluar, Active Rest, Wild Tour, watergid |
| Ірпінь | ok | Sapaequip 2026, Lost World, Wild Tour |
| Любич | ok | Active Rest, Lost World |
| Козинка | ok | Active Rest, Lost World |
| Тельбін | ok | SUP PORT 2025, Active Rest 2026 |
| Пуща / Блакитні / Редькине | ok | SUP PORT 2025 |
| Тягле | ok | Kayak Center + Telegraf 2025 |
| Унава / Остер (старі) | — | тільки до 2022 → **приховано** |
| Дніпро / Галерна / Жуків | — | червоні → **приховано** |

Машиночитаний індекс: [`club-trip-reports.json`](club-trip-reports.json) → також `public/data/club-trip-reports.json`.
