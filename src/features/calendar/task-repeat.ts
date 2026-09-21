/**
 * Turning "every day until the exam" into real dated occurrences.
 *
 * PURE and clock-free (the start date is passed in), because every date bug
 * this project has shipped came from arithmetic nobody could run in isolation:
 * the week buckets that collapsed onto one day, the whole-day events that
 * landed yesterday, the Thursdays that were 7d, 7d1h and 6d23h apart.
 *
 * MATERIALISED, not a rule evaluated at render. The calendar and Today have to
 * show a specific day and let you TICK it, and a rule cannot be ticked. Same
 * decision as the weekly night in `db/community_reggies.sql`.
 */

export type RepeatRule = 'none' | 'daily' | 'weekdays' | 'weekly'

export const REPEAT_LABEL: Record<RepeatRule, string> = {
  none: 'Just this day',
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
}

/**
 * A cap, not a limit anybody should hit. Sixty daily occurrences is two months
 * of preparation; past that it is a habit, not a plan, and a thousand rows in
 * `todos` is somebody's calendar ruined by one typo in a date field.
 */
export const MAX_OCCURRENCES = 60

/**
 * Every occurrence from `startISO` through the END of `untilISO`'s local day.
 *
 * Steps by CALENDAR DAY and re-applies the original wall-clock time, so a
 * study block set for 8 PM is 8 PM on both sides of a daylight-saving change.
 * Adding 24 hours of milliseconds would silently make it 9 PM for half the
 * term — the same class of bug as the Thursdays.
 */
export function repeatOccurrences(
  startISO: string,
  rule: RepeatRule,
  untilISO: string,
): string[] {
  const start = new Date(startISO)
  if (Number.isNaN(start.getTime())) return []
  if (rule === 'none') return [startISO]

  const until = new Date(untilISO)
  if (Number.isNaN(until.getTime())) return [startISO]
  // Through the whole of the last day: someone picking "until the 14th" means
  // the 14th is included, whatever time of day the picker happened to carry.
  const last = new Date(until)
  last.setHours(23, 59, 59, 999)

  const out: string[] = []
  const step = rule === 'weekly' ? 7 : 1
  const cursor = new Date(start)

  while (out.length < MAX_OCCURRENCES && cursor.getTime() <= last.getTime()) {
    const day = cursor.getDay()
    // Saturday and Sunday are skipped rather than moved: a prep block you did
    // not ask for on a Sunday is noise, and shifting it to Monday would put
    // two on one day.
    if (rule !== 'weekdays' || (day !== 0 && day !== 6)) {
      out.push(new Date(cursor).toISOString())
    }
    cursor.setDate(cursor.getDate() + step)
    cursor.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0)
  }

  // A weekdays rule whose start IS a weekend would otherwise return nothing,
  // which reads as the button being broken.
  return out.length > 0 ? out : [startISO]
}

/** How many occurrences a rule would create, for the form's live summary. */
export function describeRepeat(
  startISO: string,
  rule: RepeatRule,
  untilISO: string,
): string | null {
  if (rule === 'none') return null
  const n = repeatOccurrences(startISO, rule, untilISO).length
  const capped = n >= MAX_OCCURRENCES ? ` (the most we add at once is ${MAX_OCCURRENCES})` : ''
  return `${n} ${n === 1 ? 'day' : 'days'}${capped}`
}

/** Groups the occurrences of one repeat so the run can be ended together. */
export function newRepeatGroup(seed: number): string {
  return `r${seed.toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
