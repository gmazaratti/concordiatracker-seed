import type { AcademicEvent } from '@/data/academic-calendar'
import type { Assessment, Course } from '@/data/types'
import { isOpen } from '@/lib/status'
import { gradeToPercent } from '@/lib/grade'
import { parseDay, ymd } from '@/features/calendar/calendar'

/**
 * The things that go wrong quietly.
 *
 * Every expensive mistake a student makes at university has the same shape: it
 * is silent, it is dated, and by the time it announces itself the window has
 * closed. Nobody tells you that dropping on Tuesday is a refund and on Thursday
 * is a DISC on your transcript. Nobody tells you that the four courses you just
 * registered for put 62% of your grade in the same fortnight. Nobody tells you
 * that going from 12 credits to 9 ends your loan.
 *
 * This module is the watchlist. It is PURE — no network, no React — so every
 * claim it makes can be checked in Node, which matters more here than anywhere
 * else in the product: a radar that cries wolf gets switched off, and a radar
 * that stays quiet about something real is worse than not having one.
 *
 * Three rules the rules follow:
 *
 *  1. EVERY SIGNAL NAMES ITS BASIS. If we cannot say where a claim comes from,
 *     the claim does not ship. `basis` is not decoration; it is the difference
 *     between advice and a rumour.
 *  2. NOTHING IS INVENTED. A rule fires on data we hold — your grades, your
 *     deadlines, the registrar's calendar — or it does not fire.
 *  3. WE SAY WHAT WE CANNOT SEE. A course with no outline is a blind spot, and
 *     the radar says so rather than implying an all-clear.
 */

export type Severity = 'critical' | 'warning' | 'watch' | 'clear'

export interface Signal {
  id: string
  severity: Severity
  /** One line. The thing itself. */
  title: string
  /** Two or three sentences: what it means, and what it costs. */
  detail: string
  /** Where the claim comes from. Always present. */
  basis: string
  /** ISO date the window shuts, when there is one. */
  by?: string
  action?: { label: string; to: string }
  /** For grouping in the UI. */
  topic: 'load' | 'deadlines' | 'grades' | 'coverage'
}

export interface RadarInput {
  now: Date
  /** The term being run right now. */
  courses: Course[]
  pastCourses: Course[]
  assessments: Assessment[]
  calendar: AcademicEvent[]
  /** Whether the student has said their history is complete. */
  recordComplete: boolean
}

/** Concordia's full-time threshold. Verified, and cited in the signal. */
export const FULL_TIME_CREDITS = 12

const DAY = 86_400_000

/**
 * Dates here are LOCAL throughout, and that is not a detail.
 *
 * An assessment due at 23:59 on the 30th is stored as an ISO instant, which in
 * Montreal is the 31st in UTC. Slicing the string — the obvious thing — reports
 * the wrong day to the student for every evening deadline, which is most of
 * them. And `new Date('2026-10-12')` parses as UTC midnight, i.e. the evening
 * of the 11th locally, which silently collapsed the week buckets onto one.
 *
 * `ymd` and `parseDay` already solve this for the calendar; reused rather than
 * re-derived so the two views cannot disagree about what day something is on.
 */
const dayOf = (iso: string) => ymd(new Date(iso))
const daysBetween = (a: Date, b: Date) =>
  Math.round((parseDay(ymd(b)).getTime() - parseDay(ymd(a)).getTime()) / DAY)

/** Monday of the week containing `d`, as a local YYYY-MM-DD. */
export function weekStart(d: Date): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - shift)
  return ymd(copy)
}

// ── The bucket the crunch view and the crunch rule share ────────────────────

export interface WeekLoad {
  /** Monday, YYYY-MM-DD. */
  start: string
  /** Total percent-of-final-grade landing this week, across all courses. */
  weight: number
  items: Assessment[]
}

/**
 * Assessment weight, week by week.
 *
 * Weight is summed ACROSS courses on purpose. Two 25% midterms in one week is
 * half of two grades in five days, and no per-course view shows you that —
 * which is exactly why students walk into it.
 */
export function weeklyLoad(assessments: Assessment[], from: Date, weeks: number): WeekLoad[] {
  const out: WeekLoad[] = []
  // Walk a local Date forward. Round-tripping through the string and back was
  // what broke this: every step re-parsed as UTC and landed back in week one.
  const monday = parseDay(weekStart(from))
  for (let i = 0; i < weeks; i++) {
    out.push({ start: ymd(monday), weight: 0, items: [] })
    monday.setDate(monday.getDate() + 7)
  }
  const index = new Map(out.map((w) => [w.start, w]))
  for (const a of assessments) {
    const bucket = index.get(weekStart(new Date(a.due)))
    if (!bucket) continue
    bucket.items.push(a)
    bucket.weight += a.weight
  }
  for (const w of out) w.items.sort((a, b) => a.due.localeCompare(b.due))
  return out
}

// ── Rules ───────────────────────────────────────────────────────────────────

/** Below full time, with real consequences attached to the number. */
function fullTimeLoad({ courses }: RadarInput): Signal[] {
  if (courses.length === 0) return []
  const credits = courses.reduce((sum, c) => sum + c.credits, 0)
  if (credits >= FULL_TIME_CREDITS) return []
  return [
    {
      id: 'full-time',
      severity: 'warning',
      topic: 'load',
      title: `You are registered for ${credits} credits — under full time`,
      detail:
        `Concordia counts ${FULL_TIME_CREDITS} credits a term as full time. Under it, Quebec loans and ` +
        'bursaries stop, most scholarships are withheld, and some insurance and transit discounts ' +
        'lapse. If that is deliberate, ignore this. If it happened because a course was dropped, it ' +
        'is worth a call to the Birks Student Service Centre before the term settles.',
      basis: 'Your registered courses, against Concordia’s published full-time threshold.',
      action: { label: 'Your courses', to: '/app/courses' },
    },
  ]
}

/** Registrar deadlines that are about to shut, and the one that just did. */
function deadlines({ now, calendar, courses }: RadarInput): Signal[] {
  if (courses.length === 0) return []
  const out: Signal[] = []
  const soon = calendar
    .filter((e) => e.kind === 'deadline')
    .map((e) => ({ e, days: daysBetween(now, new Date(`${e.start}T12:00:00`)) }))
    .filter((x) => x.days >= 0 && x.days <= 21)
    .sort((a, b) => a.days - b.days)

  for (const { e, days } of soon.slice(0, 3)) {
    const withdrawal = /disc|withdraw/i.test(e.title)
    out.push({
      id: `deadline-${e.id}`,
      severity: days <= 3 ? 'warning' : 'watch',
      topic: 'deadlines',
      title: `${e.title} — ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`,
      detail: withdrawal
        ? 'After this date a course you leave stays on the transcript as DISC rather than ' +
          'disappearing. It does not affect your GPA, but it is visible to anyone reading the ' +
          'transcript, and the tuition is not refunded.'
        : 'From the registrar’s calendar. Deadlines here are not extended for having missed them.',
      basis: 'Concordia’s academic calendar, transcribed in this app.',
      by: e.start,
      action: { label: 'Calendar', to: '/app/calendar' },
    })
  }
  return out
}

/** Weeks where too much of your grade lands at once. */
function crunch({ now, assessments }: RadarInput): Signal[] {
  const open = assessments.filter((a) => isOpen(a.status) && new Date(a.due) >= now)
  const weeks = weeklyLoad(open, now, 16).filter(
    (w) =>
      w.weight >= 30 &&
      w.items.length >= 2 &&
      // A week whose work all lands on one day is a collision, not a crunch —
      // `sameDay` says it better, and saying both is just noise.
      new Set(w.items.map((a) => dayOf(a.due))).size >= 2,
  )
  if (weeks.length === 0) return []
  const worst = weeks.reduce((a, b) => (b.weight > a.weight ? b : a))
  return [
    {
      id: `crunch-${worst.start}`,
      severity: worst.weight >= 50 ? 'critical' : 'warning',
      topic: 'load',
      title: `${Math.round(worst.weight)}% of your grade lands in one week`,
      detail:
        `${worst.items.length} pieces of work are due in the week of ${worst.start}, worth ` +
        `${Math.round(worst.weight)}% of your final grades between them. That is not a scheduling ` +
        'quirk you can fix later — the only lever is starting earlier, and the time to know is now.',
      basis: 'Your own outlines, summed across every course rather than one at a time.',
      by: worst.start,
      action: { label: 'See the term', to: '/app/calendar' },
    },
  ]
}

/** Two heavy things on the same day. */
function sameDay({ now, assessments }: RadarInput): Signal[] {
  const open = assessments.filter((a) => isOpen(a.status) && new Date(a.due) >= now)
  const byDay = new Map<string, Assessment[]>()
  for (const a of open) {
    const key = dayOf(a.due)
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(a)
  }
  const hits = [...byDay.entries()]
    .map(([day, items]) => ({ day, items, weight: items.reduce((s, i) => s + i.weight, 0) }))
    .filter((x) => x.items.length >= 2 && x.weight >= 25)
    .sort((a, b) => a.day.localeCompare(b.day))
  if (hits.length === 0) return []
  const first = hits[0]
  return [
    {
      id: `same-day-${first.day}`,
      severity: 'warning',
      topic: 'load',
      title: `${first.items.length} things due on ${first.day}, worth ${Math.round(first.weight)}%`,
      detail:
        'Same calendar day, different courses. Neither professor knows about the other, so nobody ' +
        'is going to move it for you — but an extension asked for a week early is a different ' +
        'conversation from one asked for the night before.',
      basis: 'Due dates across your courses, compared to each other.',
      by: first.day,
      action: { label: 'Today', to: '/app' },
    },
  ]
}

/** Courses where the arithmetic has already turned against you. */
function atRisk({ courses, assessments }: RadarInput): Signal[] {
  const out: Signal[] = []
  for (const course of courses) {
    const mine = assessments.filter((a) => a.courseId === course.id)
    const graded = mine.filter((a) => a.grade !== null)
    if (graded.length === 0) continue
    const gradedWeight = graded.reduce((s, a) => s + a.weight, 0)
    const earned = graded.reduce((s, a) => s + ((gradeToPercent(a.grade) ?? 0) * a.weight) / 100, 0)
    const remaining = mine.filter((a) => a.grade === null).reduce((s, a) => s + a.weight, 0)
    if (remaining <= 0 || gradedWeight <= 0) continue

    // What average the rest has to carry to clear a C (60), the usual floor for
    // a course to count toward a programme.
    const needed = ((60 - earned) / remaining) * 100
    if (needed <= 85) continue
    out.push({
      id: `at-risk-${course.id}`,
      severity: needed > 100 ? 'critical' : 'warning',
      topic: 'grades',
      title:
        needed > 100
          ? `${course.code} can no longer reach a C`
          : `${course.code} needs ${Math.round(needed)}% on everything left`,
      detail:
        needed > 100
          ? `With ${Math.round(remaining)}% of the grade left, a C is out of reach even at full ` +
            'marks. That is worth knowing while withdrawing is still an option rather than after ' +
            'the deadline, and worth a conversation with the department either way.'
          : `${Math.round(remaining)}% of the grade is still unmarked, and it all has to land near ` +
            'the top. Possible, but not by accident.',
      basis: 'Your own entered grades and weights — the same arithmetic as the course page.',
      action: { label: course.code, to: `/app/courses/${course.id}` },
    })
  }
  return out.slice(0, 3)
}

/** A finished course whose grade may block what comes after it. */
function lowFinals({ pastCourses }: RadarInput): Signal[] {
  const low = pastCourses.filter((c) => {
    const letter = (c.finalLetter ?? '').trim().toUpperCase()
    return /^(D|D\+|D-|F|FNS|R)$/.test(letter)
  })
  if (low.length === 0) return []
  return [
    {
      id: 'low-finals',
      severity: 'watch',
      topic: 'grades',
      title: `${low.length} course${low.length === 1 ? '' : 's'} finished below C-`,
      detail:
        `${low.map((c) => c.code).join(', ')}. Several programmes require a minimum grade in their ` +
        '200-level courses before you can carry on, and a course you have to repeat is a term you ' +
        'have to find room for. Check the requirement for your own programme — it is not the same ' +
        'everywhere.',
      basis: 'The final grades in your record.',
      action: { label: 'Your programme', to: '/app/planner' },
    },
  ]
}

/** Dates ahead that rest on one classmate's word. */
function unverified({ now, assessments }: RadarInput): Signal[] {
  const horizon = new Date(now.getTime() + 21 * DAY)
  const shaky = assessments.filter(
    (a) =>
      isOpen(a.status) &&
      a.provenance.status === 'unverified' &&
      new Date(a.due) >= now &&
      new Date(a.due) <= horizon,
  )
  if (shaky.length === 0) return []
  return [
    {
      id: 'unverified-ahead',
      severity: 'watch',
      topic: 'coverage',
      title: `${shaky.length} unverified date${shaky.length === 1 ? '' : 's'} in the next three weeks`,
      detail:
        'These came from a single upload and nobody has confirmed them. They are probably right — ' +
        'but "probably" is doing a lot of work three weeks before a midterm. Worth thirty seconds ' +
        'against the real syllabus.',
      basis: 'The provenance stamped on each date when it was imported.',
      action: { label: 'Check them', to: '/app/courses' },
    },
  ]
}

/** What the radar cannot see. */
function blindSpots({ courses, assessments }: RadarInput): Signal[] {
  const blind = courses.filter((c) => !assessments.some((a) => a.courseId === c.id))
  if (blind.length === 0) return []
  return [
    {
      id: 'blind-spots',
      severity: 'watch',
      topic: 'coverage',
      title: `${blind.length} course${blind.length === 1 ? '' : 's'} with no outline`,
      detail:
        `${blind.map((c) => c.code).join(', ')} have no dates in them, so nothing above counts ` +
        'them. An empty course is not a quiet one — it is one this page is blind to.',
      basis: 'Courses in your term with no assessments entered.',
      action: { label: 'Add an outline', to: '/app/courses' },
    },
  ]
}

function recordGap({ recordComplete, pastCourses }: RadarInput): Signal[] {
  if (recordComplete || pastCourses.length > 0) return []
  return [
    {
      id: 'record-gap',
      severity: 'watch',
      topic: 'coverage',
      title: 'Your history is empty',
      detail:
        'Nothing here can check progression, prerequisites or credits until it knows what you have ' +
        'already passed. Pasting a transcript takes a minute and everything downstream gets sharper.',
      basis: 'No completed courses on file.',
      action: { label: 'Add your record', to: '/app/planner' },
    },
  ]
}

/**
 * A check is a rule that can describe itself.
 *
 * The first version was a bare array of functions, which made the page
 * impossible to explain: when nothing fired you saw an empty screen and had to
 * take on faith that anything had been looked at. A radar that only shows hits
 * is indistinguishable from a radar that is switched off.
 *
 * So every check declares what it watches for, and whether it has the data to
 * look at all. The page renders that list whether or not anything fired, which
 * means a quiet term reads as "nine things checked, all clear" instead of as a
 * blank page.
 */
export interface RadarCheck {
  id: string
  label: string
  /** One line, plain: what this looks for. Shown to the student. */
  watches: string
  topic: Signal['topic']
  /** Whether there is enough on file for this check to mean anything. */
  ready: (input: RadarInput) => boolean
  /** What it would need. Shown when `ready` is false. */
  needs: string
  run: (input: RadarInput) => Signal[]
}

const hasDated = (i: RadarInput) => i.assessments.length > 0

export const CHECKS: RadarCheck[] = [
  {
    id: 'full-time',
    label: 'Course load',
    watches: `Whether you are under the ${FULL_TIME_CREDITS} credits Concordia counts as full time.`,
    topic: 'load',
    ready: (i) => i.courses.length > 0,
    needs: 'courses in your current term',
    run: fullTimeLoad,
  },
  {
    id: 'crunch',
    label: 'Crunch weeks',
    watches: 'Weeks where a large share of your grade lands at once, across every course together.',
    topic: 'load',
    ready: hasDated,
    needs: 'at least one course outline with dates in it',
    run: crunch,
  },
  {
    id: 'same-day',
    label: 'Same-day collisions',
    watches: 'Two or more heavy things due on the same calendar day, in different courses.',
    topic: 'load',
    ready: hasDated,
    needs: 'at least one course outline with dates in it',
    run: sameDay,
  },
  {
    id: 'at-risk',
    label: 'Courses at risk',
    watches: 'Courses where the marks left can no longer realistically get you to a C.',
    topic: 'grades',
    ready: (i) => i.assessments.some((a) => a.grade !== null),
    needs: 'a grade entered on at least one assessment',
    run: atRisk,
  },
  {
    id: 'deadlines',
    label: 'Registrar deadlines',
    watches: 'Add, drop and withdrawal windows closing in the next three weeks.',
    topic: 'deadlines',
    ready: (i) => i.courses.length > 0,
    needs: 'courses in your current term',
    run: deadlines,
  },
  {
    id: 'low-finals',
    label: 'Grades that may block you',
    watches: 'Finished courses below C-, which some programmes require you to repeat.',
    topic: 'grades',
    ready: (i) => i.pastCourses.length > 0,
    needs: 'your past courses',
    run: lowFinals,
  },
  {
    id: 'unverified',
    label: 'Dates worth double-checking',
    watches: 'Upcoming dates that came from one person’s upload and nobody has confirmed.',
    topic: 'coverage',
    ready: hasDated,
    needs: 'at least one course outline with dates in it',
    run: unverified,
  },
  {
    id: 'blind-spots',
    label: 'Blind spots',
    watches: 'Courses with no outline, which nothing above can see into.',
    topic: 'coverage',
    ready: (i) => i.courses.length > 0,
    needs: 'courses in your current term',
    run: blindSpots,
  },
  {
    id: 'record-gap',
    label: 'Your history',
    watches: 'Whether enough of your record is on file for the rest of this to be worth trusting.',
    topic: 'coverage',
    ready: () => true,
    needs: '',
    run: recordGap,
  },
]

export type CheckState = 'alert' | 'clear' | 'idle'

/** Every check, what it found, and whether it could look. */
export function checkStates(
  input: RadarInput,
): { check: RadarCheck; state: CheckState; count: number }[] {
  return CHECKS.map((check) => {
    if (!check.ready(input)) return { check, state: 'idle' as const, count: 0 }
    const found = check.run(input)
    return { check, state: found.length > 0 ? ('alert' as const) : ('clear' as const), count: found.length }
  })
}

const ORDER: Record<Severity, number> = { critical: 0, warning: 1, watch: 2, clear: 3 }

/**
 * Run everything, worst first.
 *
 * Ties keep their rule order, which is deliberate: within a severity, load
 * beats deadlines beats grades beats coverage, because that is the order in
 * which a student can still do something about them.
 */
export function runRadar(input: RadarInput): Signal[] {
  const signals = CHECKS.filter((c) => c.ready(input)).flatMap((c) => c.run(input))
  return signals.sort((a, b) => ORDER[a.severity] - ORDER[b.severity])
}

/** One-line summary for the header, and for a nav badge later. */
export function radarSummary(signals: Signal[]): {
  severity: Severity
  headline: string
  counts: Record<Severity, number>
} {
  const counts: Record<Severity, number> = { critical: 0, warning: 0, watch: 0, clear: 0 }
  for (const s of signals) counts[s.severity]++
  if (counts.critical > 0)
    return {
      severity: 'critical',
      headline: `${counts.critical} thing${counts.critical === 1 ? '' : 's'} that needs deciding now`,
      counts,
    }
  if (counts.warning > 0)
    return {
      severity: 'warning',
      headline: `${counts.warning} thing${counts.warning === 1 ? '' : 's'} worth handling this week`,
      counts,
    }
  if (counts.watch > 0)
    return { severity: 'watch', headline: 'Nothing urgent, a few things to keep an eye on', counts }
  return { severity: 'clear', headline: 'Nothing on the radar', counts }
}
