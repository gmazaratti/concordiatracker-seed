import type { Assessment } from '@/data/types'
import { byDue, daysUntil } from '@/lib/date'
import { isOpen } from '@/lib/status'

/** Items due within this horizon count toward "this week". */
const WEEK_HORIZON_DAYS = 7

/** When this many items are outstanding, surface the pain-moment nudge. */
export const PAIN_THRESHOLD = 5

export interface DueGroups {
  overdue: Assessment[]
  thisWeek: Assessment[]
  /** Outstanding work due beyond the week horizon — the "Coming up" section. */
  later: Assessment[]
  /**
   * Open work whose date is not known yet.
   *
   * Its own bucket rather than the bottom of "later", because it is not late —
   * it is unscheduled, and those are different problems with different fixes.
   * It cannot be near-term pressure (nothing without a date can be), so it
   * stays out of `active` and `count`, but it counts toward `total` so the due
   * list does not quietly under-report how much is outstanding.
   */
  undated: Assessment[]
  /** Overdue + this week, oldest-due first — the near-term pressure (pain nudge). */
  active: Assessment[]
  /** Soonest outstanding item across everything — drives "next up". */
  nextUp: Assessment | null
  /** Near-term count (overdue + this week) — drives the pain nudge + glance. */
  count: number
  /** All outstanding (overdue + this week + later) — the due-list size. */
  total: number
}

/** Split outstanding work into the buckets Today cares about. Anything done, or
 * due beyond the week horizon, is intentionally left off this screen. */
export function groupDue(assessments: Assessment[]): DueGroups {
  const outstanding = assessments.filter((a) => isOpen(a.status))
  const undated = outstanding.filter((a) => !a.due)
  // Everything below reasons about a point in time, so it works on the dated
  // half only. Narrowed once here rather than re-checked in six places.
  const dated = outstanding.filter((a): a is Assessment & { due: string } => !!a.due)

  const overdue = dated.filter((a) => daysUntil(a.due) < 0).sort(byDue)
  const thisWeek = dated
    .filter((a) => {
      const d = daysUntil(a.due)
      return d >= 0 && d < WEEK_HORIZON_DAYS
    })
    .sort(byDue)
  const later = dated.filter((a) => daysUntil(a.due) >= WEEK_HORIZON_DAYS).sort(byDue)

  const active = [...overdue, ...thisWeek]

  // "Next up" = the soonest deadline still ahead of us (overdue work is already
  // surfaced in its own bucket); fall back to the soonest overall if nothing's
  // upcoming. An undated item is never "next" — there is no date to be next.
  const upcoming = dated.filter((a) => daysUntil(a.due) >= 0).sort(byDue)
  const nextUp = upcoming[0] ?? [...dated].sort(byDue)[0] ?? null

  return {
    overdue,
    thisWeek,
    later,
    undated,
    active,
    nextUp,
    count: active.length,
    total: active.length + later.length + undated.length,
  }
}
