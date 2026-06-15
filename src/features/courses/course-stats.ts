import type { Assessment } from '@/data/types'
import { daysUntil } from '@/lib/date'
import { isOpen } from '@/lib/status'

export interface CourseStats {
  openCount: number
  overdueCount: number
  /** Soonest open item — upcoming first, else the most overdue. */
  nextDue: Assessment | null
}

const byDue = (a: Assessment, b: Assessment) =>
  new Date(a.due).getTime() - new Date(b.due).getTime()

/** Card-level summary of a single course's outstanding work. */
export function courseStats(assessments: Assessment[]): CourseStats {
  const open = assessments.filter((a) => isOpen(a.status)).sort(byDue)
  const overdueCount = open.filter((a) => daysUntil(a.due) < 0).length
  const upcoming = open.filter((a) => daysUntil(a.due) >= 0)
  return {
    openCount: open.length,
    overdueCount,
    nextDue: upcoming[0] ?? open[0] ?? null,
  }
}
