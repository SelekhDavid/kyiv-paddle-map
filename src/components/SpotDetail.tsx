import type { MapMode, RulesDoc, Spot, WaterIncident, WaterQualitySiteMarker } from '../types'
import {
  INCIDENT_COLORS,
  INCIDENT_STATUS_LABELS,
  PADDLE_COLORS,
  PADDLE_LABELS,
  RESTRICTION_COLORS,
  RESTRICTION_LABELS,
  WATER_QUALITY_COLORS,
  WATER_QUALITY_LABELS,
  DETAIL_RIVER_SWATCH,
  amenityLabel,
  kindLabel,
  loadDots,
  paddleSuitabilityLabel,
  regionLabel,
  swimSuitabilityLabel,
} from '../lib/labels'

interface Props {
  spot: Spot | null
  rules: RulesDoc | null
  checkedAt: string | null
  mapMode?: MapMode
  widthM?: number | null
  waterQuality?: WaterQualitySiteMarker[]
  incidents?: WaterIncident[]
  onClose: () => void
}

export function SpotDetail({
  spot,
  rules,
  checkedAt,
  mapMode = 'restrictions',
  widthM = null,
  waterQuality = [],
  incidents = [],
  onClose,
}: Props) {
  if (!spot) {
    return (
      <aside className="panel detail empty">
        <h2>Деталі</h2>
        <p>Оберіть водойму на карті або в списку.</p>
        {rules && (
          <div className="disclaimer">
            <p>{rules.disclaimerUk}</p>
            <p className="method">{rules.touristLoadMethod.approachUk}</p>
            {mapMode !== 'detail' && checkedAt && (
              <p className="meta">Дані перевірені станом на {checkedAt}</p>
            )}
          </div>
        )}
      </aside>
    )
  }

  const paddleMode = mapMode === 'paddle' && spot.paddleVerdict
  const detailMode = mapMode === 'detail'
  const badgeColor = detailMode
    ? DETAIL_RIVER_SWATCH
    : paddleMode
      ? PADDLE_COLORS[spot.paddleVerdict!]
      : RESTRICTION_COLORS[spot.restriction.level]
  const badgeLabel = detailMode
    ? widthM != null && Number.isFinite(widthM) && widthM > 1
      ? `Ширина ≈ ${Math.round(widthM)} м`
      : 'Немає відображуваної ширини'
    : paddleMode
      ? PADDLE_LABELS[spot.paddleVerdict!]
      : RESTRICTION_LABELS[spot.restriction.level]

  return (
    <aside className="panel detail">
      <header>
        <div>
          <p className="kind">
            {kindLabel(spot.kind)} · {regionLabel(spot.region)}
          </p>
          <h2>{spot.nameUk}</h2>
          <p className="en">{spot.nameEn}</p>
          {spot.matchedOsmNameUk &&
          spot.matchedOsmNameUk !== spot.nameUk &&
          !spot.nameUk.includes(spot.matchedOsmNameUk) ? (
            <p className="meta osm-aka">У OpenStreetMap: {spot.matchedOsmNameUk}</p>
          ) : null}
        </div>
        <button type="button" className="close" onClick={onClose} aria-label="Закрити">
          ×
        </button>
      </header>

      <div className="badge" style={{ borderColor: badgeColor }}>
        <span className="dot" style={{ background: badgeColor }} />
        {badgeLabel}
      </div>

      {detailMode ? (
        <>
          <p className="meta color-meaning">
            У режимі «детально» річки &gt; 1 м ширини — сині; червоні заборони навігації приховані.
            Кружечки — проби води; фіолетові ромби — інциденти.
          </p>
          {waterQuality.length > 0 && (
            <div className="sources">
              <h3>Проби води (Плесо / МОЗ / ЦКПХ)</h3>
              <ul>
                {waterQuality.map((s) => (
                  <li key={s.id}>
                    <span
                      className="swatch inline"
                      style={{ background: WATER_QUALITY_COLORS[s.status] }}
                    />{' '}
                    <strong>{s.nameUk}</strong> — {WATER_QUALITY_LABELS[s.status]}
                    {s.authority ? ` · ${s.authority}` : ''}
                    {s.sampledAt ? ` (${s.sampledAt.slice(0, 10)})` : ''}
                    {s.metricsNoteUk ? <small> — {s.metricsNoteUk}</small> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {incidents.length > 0 && (
            <div className="sources">
              <h3>Інциденти</h3>
              <ul>
                {incidents.map((inc) => (
                  <li key={inc.id}>
                    <span
                      className="swatch inline"
                      style={{ background: INCIDENT_COLORS[inc.severity] }}
                    />{' '}
                    <strong>{inc.titleUk}</strong> —{' '}
                    {INCIDENT_STATUS_LABELS[inc.status] || inc.status}
                    {inc.summaryUk ? <small> — {inc.summaryUk}</small> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : paddleMode ? (
        <>
          <p className="restriction-label">За свіжими турами, прокатом і звітами</p>
          {spot.paddleNotesUk && <p>{spot.paddleNotesUk}</p>}
          <p className="meta color-meaning">
            Синій означає: з 2023 року є згадки, що тут плавають. Сірий — у свіжих відгуках сплав
            описують як складний або недоцільний. Повну заборону навігації дивіться в режимі
            «Правила і заборони».
          </p>
        </>
      ) : (
        <>
          <p className="restriction-label">{spot.restriction.labelUk}</p>
          <p>{spot.restriction.notesUk}</p>
          <p className="meta color-meaning">
            Колір показує місцеві рішення громад і відомості про конкретну ділянку. Окрема загальна
            заборона області на навігацію може діяти всюди, але сама по собі не фарбує всі водойми
            жовтим.
          </p>
        </>
      )}
      {!detailMode && checkedAt && (
        <p className="meta">Дані перевірені станом на {checkedAt}</p>
      )}

      <dl>
        {!detailMode && (
          <>
            <div>
              <dt>Придатність для SUP</dt>
              <dd>{paddleSuitabilityLabel(spot.paddleSuitability)}</dd>
            </div>
            <div>
              <dt>Купання</dt>
              <dd>{swimSuitabilityLabel(spot.swimSuitability)}</dd>
            </div>
          </>
        )}
        {!paddleMode && !detailMode && (
          <div>
            <dt>Наскільки людне</dt>
            <dd>
              {loadDots(spot.touristLoad.grade)} {spot.touristLoad.grade}/5 — {spot.touristLoad.labelUk}
              <br />
              <small>{spot.touristLoad.peakHintUk}</small>
            </dd>
          </div>
        )}
        <div>
          <dt>Як дістатися / доступ</dt>
          <dd>{spot.accessUk}</dd>
        </div>
        <div>
          <dt>Коротка порада</dt>
          <dd>{spot.tipsUk}</dd>
        </div>
        {spot.amenities.length > 0 && (
          <div>
            <dt>Що є на місці</dt>
            <dd>{spot.amenities.map(amenityLabel).join(' · ')}</dd>
          </div>
        )}
      </dl>

      {!detailMode && spot.paddleReports && spot.paddleReports.length > 0 && (
        <div className="sources">
          <h3>Звідки відомо про сплав</h3>
          <ul>
            {spot.paddleReports.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer">
                  {r.title}
                  {r.year ? ` (${r.year})` : ''}
                </a>
                {r.hazardsUk && r.hazardsUk.length > 0 ? (
                  <small> — {r.hazardsUk.slice(0, 3).join('; ')}</small>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!paddleMode && !detailMode && spot.restriction.sources.length > 0 && (
        <div className="sources">
          <h3>Документи про обмеження</h3>
          <ul>
            {spot.restriction.sources.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer">
                  {url.replace(/^https?:\/\//, '').slice(0, 48)}…
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!detailMode && (
        <p className="meta">
          Оцінку людності оновлено: {spot.touristLoad.updated} · джерела:{' '}
          {spot.touristLoad.sources.join(', ')}
        </p>
      )}
    </aside>
  )
}
