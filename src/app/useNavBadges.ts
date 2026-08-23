import { useMemo } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { daysUntil } from '@/lib/date'
import { isOpen } from '@/lib/status'

export interface NavBadge {
  count: number
  /** danger = overdue/needs attention now; accent = worth a look. */
  tone: 'danger' | 'accent'
  /** Screen-reader description ("3 overdue"). */
  label: string
}

/**
 * Counts for the sidebar / bottom-bar tabs, keyed by route. Deliberately
 * SELECTIVE — a badge on every tab is wallpaper, not signal. Only two things
 * earn one:
 *
 *   • Today   — work that's overdue (danger) or due today (accent).
 *   • Courses — peer date-corrections waiting on a decision.
 *
 * Calendar and Community stay unbadged: nothing there is an action you owe.
 */
export function useNavBadges(): Record<string, NavBadge | undefined> {
  const { assessments, peerCorrections } = useAppData()

  return useMemo(() => {
    let overdue = 0
    let dueToday = 0
    for (const a of assessments) {
      if (!isOpen(a.status) || !a.due) continue
      const d = daysUntil(a.due)
      if (d < 0) overdue++
      else if (d === 0) dueToday++
    }

    const badges: Record<string, NavBadge | undefined> = {}

    if (overdue > 0) {
      badges['/app'] = {
        count: overdue,
        tone: 'danger',
        label: `${overdue} overdue`,
      }
    } else if (dueToday > 0) {
      badges['/app'] = {
        count: dueToday,
        tone: 'accent',
        label: `${dueToday} due today`,
      }
    }

    // Classmate date changes are a real decision the student owes.
    const corrections = peerCorrections.length
    if (corrections > 0) {
      badges['/app/courses'] = {
        count: corrections,
        tone: 'accent',
        label: `${corrections} date change${corrections === 1 ? '' : 's'} to review`,
      }
    }

    return badges
  }, [assessments, peerCorrections])
}
