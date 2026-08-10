import type { RestrictionLevel } from './types'

export const RESTRICTION_COLORS: Record<RestrictionLevel, string> = {
  banned_navigation: '#c0392b',
  oblast_ban: '#d35400',
  restricted: '#e67e22',
  check_local: '#27ae60',
  likely_ok: '#1e8449',
}

export const RESTRICTION_LABELS: Record<RestrictionLevel, string> = {
  banned_navigation: 'Виходити на воду заборонено',
  oblast_ban: 'Обласна заборона',
  restricted: 'Є заборона від громади',
  check_local: 'Перевірте правила на місці',
  likely_ok: 'Немає відомої заборони громади',
}

export function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    lake: 'озеро',
    river: 'річка',
    reservoir: 'водосховище',
    quarry: 'карʼєр',
    pond: 'ставок',
    basin: 'котлован / басейн',
    oxbow: 'стариця',
    bay: 'затока',
    channel: 'канал',
    other: 'інше',
  }
  return map[kind] || kind
}

export function fitsSearch(hay: string, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return hay.toLowerCase().includes(needle)
}
