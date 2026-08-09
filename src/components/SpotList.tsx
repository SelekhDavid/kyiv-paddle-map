import type { MapMode, Spot } from '../types'
import {
  DETAIL_RIVER_SWATCH,
  PADDLE_COLORS,
  PADDLE_LABELS,
  RESTRICTION_COLORS,
  RESTRICTION_LABELS,
  kindLabel,
  loadDots,
  regionLabel,
} from '../lib/labels'

interface Props {
  spots: Spot[]
  selectedId: string | null
  onSelect: (id: string) => void
  mapMode?: MapMode
}

export function SpotList({ spots, selectedId, onSelect, mapMode = 'restrictions' }: Props) {
  const paddleMode = mapMode === 'paddle'
  const detailMode = mapMode === 'detail'
  return (
    <section className="panel spot-list">
      <h2>Водойми ({spots.length})</h2>
      <ul>
        {spots.map((s) => {
          const color = detailMode
            ? DETAIL_RIVER_SWATCH
            : paddleMode
              ? PADDLE_COLORS[s.paddleVerdict || 'ok']
              : RESTRICTION_COLORS[s.restriction.level]
          const status = detailMode
            ? regionLabel(s.region)
            : paddleMode
              ? PADDLE_LABELS[s.paddleVerdict || 'ok']
              : RESTRICTION_LABELS[s.restriction.level]
          return (
            <li key={s.id}>
              <button
                type="button"
                className={s.id === selectedId ? 'spot active' : 'spot'}
                onClick={() => onSelect(s.id)}
              >
                <span className="dot" style={{ background: color }} aria-hidden />
                <span className="spot-body">
                  <strong>
                    {s.nameUk}
                    {s.derived ? <em className="derived"> з мапи</em> : null}
                  </strong>
                  {s.matchedOsmNameUk &&
                  s.matchedOsmNameUk !== s.nameUk &&
                  !s.nameUk.includes(s.matchedOsmNameUk) ? (
                    <small className="osm-aka">OSM: {s.matchedOsmNameUk}</small>
                  ) : null}
                  <small>
                    {kindLabel(s.kind)} · {status}
                    {!paddleMode && !detailMode ? <> · {loadDots(s.touristLoad.grade)}</> : null}
                  </small>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
