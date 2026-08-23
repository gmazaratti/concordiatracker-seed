import type { Assessment } from '@/data/types'
import { byDue, daysUntil } from '@/lib/date'
import { isOpen } from '@/lib/status'

export interface CourseStats {
  openCount: number
  overdueCount: number
  /** Soonest open item — upcoming first, else the most overdue. */
  nextDue: Assessment | null
}

/** Card-level summary of a single course's outstanding work. */
export function courseStats(assessments: Assessment[]): CourseStats {
  const open = assessments.filter((a) => isOpen(a.status)).sort(byDue)
  // "Next due" needs a date to be next; undated work still counts as open.
  const dated = open.filter((a): a is Assessment & { due: string } => !!a.due)
  const overdueCount = dated.filter((a) => daysUntil(a.due) < 0).length
  const upcoming = dated.filter((a) => daysUntil(a.due) >= 0)
  return {
    openCount: open.length,
    overdueCount,
    nextDue: upcoming[0] ?? dated[0] ?? null,
  }
}
