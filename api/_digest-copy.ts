/**
 * The words in the Monday digest: subject line, preview line, and the P.S.
 * PURE (no imports, clock passed in) so it is testable in Node.
 *
 * A subject that reads like a report ("Your week: 4 due") is one you archive
 * unread. These lead with the single most useful fact, usually the nearest
 * deadline by name, in the voice of a friend who checked your calendar.
 * No em dashes, and at most one emoji.
 */

export interface DigestItem {
  course: string | null
  title: string
  due: string // ISO
}

const ZONE = 'America/Montreal'

function dayKey(iso: string | number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
}

/** "today", "tomorrow", or the weekday name, in Montreal time. */
export function dayWord(due: string, now: number): string {
  if (dayKey(due) === dayKey(now)) return 'today'
  if (dayKey(due) === dayKey(now + 86_400_000)) return 'tomorrow'
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, weekday: 'long' }).format(new Date(due))
}

function named(i: DigestItem): string {
  return i.course ? `${i.course} ${i.title}` : i.title
}

/** Pick deterministically by week, so the same person does not get the same joke every Monday. */
function pick<T>(list: T[], now: number): T {
  const week = Math.floor(now / (7 * 86_400_000))
  return list[week % list.length]
}

export function digestSubject(upcoming: DigestItem[], overdue: number, now: number): string {
  const next = upcoming[0]
  if (next && overdue > 0) {
    return `${overdue} overdue, and ${named(next)} is ${dayWord(next.due, now)}`
  }
  if (overdue > 0) {
    return overdue === 1 ? '1 thing is overdue. We will not tell your prof.' : `${overdue} things are overdue. We will not tell your prof.`
  }
  if (!next) return 'Nothing due this week. Suspicious.'
  const when = dayWord(next.due, now)
  if (upcoming.length === 1) return `Just one thing this week: ${named(next)}, ${when}`
  if (when === 'today' || when === 'tomorrow') return `Heads up: ${named(next)} is ${when} 👀`
  if (upcoming.length >= 5) {
    return pick(
      [
        `${upcoming.length} deadlines walk into your week. Here's the plan.`,
        `Big week: ${upcoming.length} things due, starting ${when}`,
        `${upcoming.length} things due this week. Coffee first, then this.`,
      ],
      now,
    )
  }
  return pick(
    [`${named(next)} is ${when}, plus ${upcoming.length - 1} more`, `Your week: ${named(next)} on ${when} and ${upcoming.length - 1} more`],
    now,
  )
}

/** The line the inbox shows next to the subject. */
export function digestPreheader(upcoming: DigestItem[], overdue: number): string {
  if (upcoming.length === 0) return overdue ? 'A quick tidy-up and you are back on track.' : 'Enjoy it.'
  return `Everything due in the next 7 days, soonest first.${overdue ? ` Plus ${overdue} still open from before.` : ''}`
}

const TIPS = [
  'Tick things off as you hand them in and this email gets shorter every week.',
  'Got a syllabus with a date we missed? Fix it on the course page and your classmates get the correction too.',
  'You can turn on reminders for each deadline in Settings, so nothing sneaks up on you.',
  'Connect Moodle once and the deadlines your profs post land here on their own.',
]

export function digestPs(now: number): string {
  return pick(TIPS, now)
}

/** A day chip for the agenda: "TUE" and "17", in Montreal time. */
export function agendaParts(due: string, now: number): { day: string; date: string; time: string; urgent: boolean } {
  const d = new Date(due)
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, weekday: 'short' }).format(d).replace('.', '').toUpperCase()
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, day: 'numeric' }).format(d)
  const time = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE, hour: 'numeric', minute: '2-digit' }).format(d)
  const w = dayWord(due, now)
  const urgent = w === 'today' || w === 'tomorrow'
  return { day, date, time: urgent ? `Due ${w}, ${time}` : `Due ${time}`, urgent }
}
