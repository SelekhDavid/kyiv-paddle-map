import type { PaddleReportRef, PaddleVerdict, RestrictionLevel } from '../types'

export interface ClubTripEntry {
  coverage?: string
  reports?: PaddleReportRef[]
  notesUk?: string
  spotRefs?: string[]
}

export interface ClubTripReportsDoc {
  checkedAt?: string
  methodUk?: string
  minReportYear?: number
  bySpotId?: Record<string, ClubTripEntry>
  byRiverNameToken?: Record<string, ClubTripEntry>
}

/** Only green / yellow restriction layers appear in «де поплавати». */
export const PADDLE_MAP_RESTRICTION_LEVELS: RestrictionLevel[] = [
  'likely_ok',
  'check_local',
  'restricted',
  'oblast_ban',
]

export const PADDLE_MIN_REPORT_YEAR = 2023

const NEGATIVE_RE =
  /людського маршруту не вийде|непрохідн|немає сенсу|не рекомендую сплав|непридатн/i

export function isPaddleMapRestriction(level: RestrictionLevel | null | undefined): boolean {
  if (!level) return false
  return PADDLE_MAP_RESTRICTION_LEVELS.includes(level)
}

export function recentReports(
  reports: PaddleReportRef[] | undefined,
  minYear = PADDLE_MIN_REPORT_YEAR,
): PaddleReportRef[] {
  return (reports || []).filter((r) => typeof r.year === 'number' && r.year >= minYear)
}

/** Derive map color verdict from reports/rental evidence from 2023 onward only. */
export function paddleVerdictFromEntry(entry: ClubTripEntry | undefined): PaddleVerdict | undefined {
  if (!entry) return undefined
  const coverage = entry.coverage || 'none'
  if (coverage === 'none') return undefined
  if (coverage === 'index_only') return undefined

  const reports = recentReports(entry.reports)
  if (coverage === 'thin_negative') {
    if (reports.length === 0) return undefined
    return 'negative'
  }

  if (reports.length === 0) return undefined

  const blob = [
    entry.notesUk || '',
    ...reports.flatMap((r) => [r.title, ...(r.hazardsUk || [])]),
  ].join(' ')
  if (NEGATIVE_RE.test(blob)) return 'negative'

  return 'ok'
}
