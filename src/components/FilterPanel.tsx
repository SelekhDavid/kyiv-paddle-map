import type { Filters } from '../types'
import {
  DETAIL_RIVER_SWATCH,
  HAZARD_COLORS,
  INCIDENT_COLORS,
  PADDLE_COLORS,
  PADDLE_LABELS,
  RESTRICTION_COLORS,
  RESTRICTION_LABELS,
  WATER_QUALITY_COLORS,
  WATER_QUALITY_LABELS,
} from '../lib/labels'

interface Props {
  filters: Filters
  onChange: (next: Filters) => void
  shapeCount: number
  visibleCount: number
  totalCount: number
}

export function FilterPanel({ filters, onChange, shapeCount, visibleCount, totalCount }: Props) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value })

  const paddleMode = filters.mapMode === 'paddle'
  const detailMode = filters.mapMode === 'detail'
  const restrictionsMode = filters.mapMode === 'restrictions'

  return (
    <section className="panel filters">
      <h2>Фільтри</h2>
      <label className="search">
        <span>Пошук</span>
        <input
          type="search"
          placeholder="Назва: Тельбін, Десна, карʼєр…"
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </label>

      <fieldset>
        <legend>Що показує карта</legend>
        <label>
          <input
            type="radio"
            name="mapMode"
            checked={restrictionsMode}
            onChange={() => set('mapMode', 'restrictions')}
          />
          Правила і заборони
        </label>
        <label>
          <input
            type="radio"
            name="mapMode"
            checked={paddleMode}
            onChange={() => set('mapMode', 'paddle')}
          />
          Де останнім часом плавають
        </label>
        <label>
          <input
            type="radio"
            name="mapMode"
            checked={detailMode}
            onChange={() => set('mapMode', 'detail')}
          />
          Детально
        </label>
      </fieldset>

      {paddleMode && (
        <fieldset>
          <legend>За свіжими згадками</legend>
          <p className="meta legend-row">
            <span className="swatch" style={{ background: PADDLE_COLORS.ok }} />
            {PADDLE_LABELS.ok}
          </p>
          <p className="meta legend-row">
            <span className="swatch" style={{ background: PADDLE_COLORS.negative }} />
            {PADDLE_LABELS.negative}
          </p>
          <p className="meta">
            Показуємо місця, де знайшли тури, прокат чи звіти з 2023 року й пізніше. Водойми з
            повною забороною навігації (червоні) сюди не потрапляють.
          </p>
        </fieldset>
      )}

      {restrictionsMode && (
        <fieldset>
          <legend>Колір = що відомо про правила</legend>
          <label>
            <input
              type="checkbox"
              checked={filters.showBanned}
              onChange={(e) => set('showBanned', e.target.checked)}
            />
            <span className="swatch" style={{ background: RESTRICTION_COLORS.banned_navigation }} />
            {RESTRICTION_LABELS.banned_navigation} (Дніпро та водосховища)
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.showRestricted}
              onChange={(e) => set('showRestricted', e.target.checked)}
            />
            <span className="swatch" style={{ background: RESTRICTION_COLORS.restricted }} />
            {RESTRICTION_LABELS.restricted}
            <span className="swatch" style={{ background: RESTRICTION_COLORS.oblast_ban }} />
            {RESTRICTION_LABELS.oblast_ban}
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.showCheckLocal}
              onChange={(e) => set('showCheckLocal', e.target.checked)}
            />
            <span className="swatch" style={{ background: RESTRICTION_COLORS.check_local }} />
            {RESTRICTION_LABELS.check_local} / {RESTRICTION_LABELS.likely_ok}
          </label>
        </fieldset>
      )}

      {detailMode && (
        <fieldset>
          <legend>Річки в режимі «детально»</legend>
          <p className="meta legend-row">
            <span className="swatch" style={{ background: DETAIL_RIVER_SWATCH }} />
            є оцінка ширини &gt; 1 м (синій)
          </p>
          <p className="meta">
            Без ширини або з OSM «1 м», а також червоні (повна заборона навігації) — не показуємо.
          </p>
        </fieldset>
      )}

      <fieldset>
        <legend>Тип водойми</legend>
        {(
          [
            ['lake', 'озера'],
            ['reservoir', 'водосховища'],
            ['river', 'річки'],
            ['quarry', 'карʼєри'],
            ['pond', 'ставки'],
            ['basin', 'котловани / басейни'],
            ['other', 'інше'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            <input
              type="checkbox"
              checked={filters.kinds[key]}
              onChange={(e) =>
                set('kinds', { ...filters.kinds, [key]: e.target.checked })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      {restrictionsMode && (
        <label className="range">
          <span>Наскільки людне місце (макс. {filters.maxTouristLoad} з 5)</span>
          <input
            type="range"
            min={1}
            max={5}
            value={filters.maxTouristLoad}
            onChange={(e) => set('maxTouristLoad', Number(e.target.value))}
          />
        </label>
      )}

      <label>
        <input
          type="checkbox"
          checked={filters.showAllShapes}
          onChange={(e) => set('showAllShapes', e.target.checked)}
        />
        Показати повні контури водойм ({shapeCount})
      </label>
      <label>
        <input
          type="checkbox"
          checked={filters.showFlow}
          onChange={(e) => set('showFlow', e.target.checked)}
        />
        Показати напрям течії на річках
      </label>

      {detailMode && (
        <fieldset>
          <legend>Шари деталей</legend>
          <label>
            <input
              type="checkbox"
              checked={filters.showHazards}
              onChange={(e) => set('showHazards', e.target.checked)}
            />
            <span className="swatch" style={{ background: HAZARD_COLORS.major }} />
            Перешкоди (дамби, шлюзи, колектори…)
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.showHydroPosts}
              onChange={(e) => set('showHydroPosts', e.target.checked)}
            />
            <span className="swatch" style={{ background: '#0d9488' }} />
            Гідропости (бірюзовий ромб)
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.showWaterQuality}
              onChange={(e) => set('showWaterQuality', e.target.checked)}
            />
            <span className="swatch" style={{ background: WATER_QUALITY_COLORS.ok }} />
            Проби води — кружечки (Плесо / МОЗ / ЦКПХ)
          </label>
          <p className="meta legend-row">
            <span className="swatch" style={{ background: WATER_QUALITY_COLORS.ok }} />
            {WATER_QUALITY_LABELS.ok}
            <span className="swatch" style={{ background: WATER_QUALITY_COLORS.advisory }} />
            {WATER_QUALITY_LABELS.advisory}
          </p>
          <label>
            <input
              type="checkbox"
              checked={filters.showIncidents}
              onChange={(e) => set('showIncidents', e.target.checked)}
            />
            <span className="swatch" style={{ background: INCIDENT_COLORS.high }} />
            Інциденти — фіолетові ромби (розливи, цвітіння…)
          </label>
        </fieldset>
      )}

      <p className="meta">
        У списку: {visibleCount} з {totalCount}
      </p>
    </section>
  )
}
