import type { Assessment } from '@/data/types'
import { daysUntil } from '@/lib/date'
import { isOpen } from '@/lib/status'

/** Items due within this horizon count toward "this week". */
const WEEK_HORIZON_DAYS = 7

/** When this many items are outstanding, surface the pain-moment nudge. */
export const PAIN_THRESHOLD = 5

export interface DueGroups {
  overdue: Assessment[]
  thisWeek: Assessment[]
  /** Outstanding items that feed Today (overdue + this week), oldest-due first. */
  active: Assessment[]
  /** Soonest outstanding item across everything — drives "next up". */
  nextUp: Assessment | null
  count: number
}

const byDue = (a: Assessment, b: Assessment) =>
  new Date(a.due).getTime() - new Date(b.due).getTime()

/** Split outstanding work into the buckets Today cares about. Anything done, or
 * due beyond the week horizon, is intentionally left off this screen. */
export function groupDue(assessments: Assessment[]): DueGroups {
  const outstanding = assessments.filter((a) => isOpen(a.status))

  const overdue = outstanding.filter((a) => daysUntil(a.due) < 0).sort(byDue)
  const thisWeek = outstanding
    .filter((a) => {
      const d = daysUntil(a.due)
      return d >= 0 && d < WEEK_HORIZON_DAYS
    })
    .sort(byDue)

  const active = [...overdue, ...thisWeek]

  // "Next up" = the soonest deadline still ahead of us (overdue work is already
  // surfaced in its own bucket); fall back to the soonest overall if nothing's
  // upcoming.
  const upcoming = outstanding.filter((a) => daysUntil(a.due) >= 0).sort(byDue)
  const nextUp = upcoming[0] ?? [...outstanding].sort(byDue)[0] ?? null

  return { overdue, thisWeek, active, nextUp, count: active.length }
}
