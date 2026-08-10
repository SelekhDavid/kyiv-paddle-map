import type { Spot } from './types'
import { dataUrl } from './dataUrl'
import { inMapExtent } from './mapExtent'

export async function loadSpots(signal?: AbortSignal): Promise<Spot[]> {
  const res = await fetch(dataUrl('spots.json'), { signal })
  if (!res.ok) throw new Error('Не вдалося завантажити локації')
  const raw = (await res.json()) as Spot[]
  return raw.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng) && inMapExtent(s.lat, s.lng))
}
