/** Date helpers. All "today" math is relative to the runtime clock so the
 * seeded demo (overdue / this-week) stays correct whenever it's opened. */

const DAY_MS = 86_400_000

/** Midnight local time for the current day. */
export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** ISO timestamp `n` days from now (n may be negative). Used to seed mock data
 * at a fixed wall-clock time of day so labels read naturally. */
export function daysFromNow(n: number, hour = 23, minute = 59): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** Whole calendar days from today to `due` (negative = overdue). */
export function daysUntil(due: string): number {
  const target = new Date(due)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - startOfToday().getTime()) / DAY_MS)
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

/** Compact, human due label: "2 days overdue", "Due today", "Due Fri", "Due Jun 20". */
export function relativeDueLabel(due: string): string {
  const days = daysUntil(due)
  if (days < 0) {
    const n = Math.abs(days)
    return n === 1 ? '1 day overdue' : `${n} days overdue`
  }
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days < 7) return `Due ${WEEKDAY.format(new Date(due))}`
  return `Due ${MONTH_DAY.format(new Date(due))}`
}

/** Full date for tooltips / secondary lines: "Fri, Jun 20". */
export function formatFull(due: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(due))
}
