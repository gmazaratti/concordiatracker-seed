/**
 * Feature discovery: which ONE thing should this student hear about next?
 *
 * Measured 2026-11-10: the typical account had used 4 of 14 features, and the
 * ones nobody found (past courses, the grade calculator, the schedule builder)
 * are the ones that make people stay. A tour does not fix that, because a tour
 * shows everything to everyone on day one, when none of it means anything yet.
 *
 * So this scores each feature FOR ONE PERSON from what their account looks
 * like right now, and only ever names something they have not used:
 *   - a course with no deadlines        -> scan the outline
 *   - a low grade in one class          -> "what do I need on the rest?"
 *   - no finished courses on record     -> add past courses, see a real GPA
 *   - registration month, no schedule   -> the schedule builder
 * The reason is carried with every result, so a nudge can be explained and
 * tested rather than trusted.
 *
 * PURE: no React, no network, the clock is passed in. Node-tested.
 */

export interface FeatureUsage {
  account_days: number | null
  schedule: boolean
  seat_watch: boolean
  calendar_sync: boolean
  moodle: boolean
  notes: boolean
  clubs: boolean
  family: boolean
  programme: boolean
  scanned: boolean
}

export interface DiscoverySignals {
  /** Null until it loads: features that need it are simply not offered yet. */
  usage: FeatureUsage | null
  currentCourses: number
  /** Current courses with no assessments at all. */
  emptyCourse: { id: string; code: string } | null
  pastCourses: number
  gradedCount: number
  /** A course with work marked done or past due and no grade entered. */
  ungradedCourse: { id: string; code: string } | null
  gpa: number | null
  /** The lowest-standing current course that has at least one grade. */
  weakest: { id: string; code: string; percent: number } | null
  upcomingDated: number
  hasReminders: boolean
  personalTasks: number
  pro: boolean
  atConcordia: boolean
  desktop: boolean
  /** 0-11. Registration months raise the planning features. */
  month: number
}

export interface DiscoveryState {
  /** "Don't show this again": never offered again. */
  dismissed?: string[]
  /** Opened from a nudge. For features we cannot measure, this counts as used. */
  tried?: string[]
  /** id -> ISO time the card may come back ("Not now"). */
  snoozed?: Record<string, string>
  /** id -> ISO time a popup showed it. A popup never repeats a feature. */
  popped?: Record<string, string>
  lastPop?: string
}

export type DiscoveryIcon =
  | 'scan' | 'grade' | 'history' | 'target' | 'trend' | 'moodle' | 'degree' | 'schedule'
  | 'seat' | 'bell' | 'calendar' | 'clubs' | 'notes' | 'family' | 'tasks'

export interface Nudge {
  id: string
  icon: DiscoveryIcon
  /** Short, fits one line. */
  title: string
  body: string
  cta: string
  to: string
  score: number
  /** Why this person, in plain words. Shown in tests and the admin preview. */
  reason: string
}

/** Months when next term's registration is on students' minds. */
const REGISTRATION_MONTHS = new Set([2, 3, 6, 7, 10, 11])

/** Every nudge that applies to this person, unranked and unfiltered. */
export function candidates(s: DiscoverySignals): Nudge[] {
  const out: Nudge[] = []
  const add = (n: Nudge) => out.push(n)
  const u = s.usage
  const registering = REGISTRATION_MONTHS.has(s.month)

  if (s.emptyCourse) {
    add({
      id: 'scan', icon: 'scan', score: 95,
      title: `${s.emptyCourse.code} has no deadlines yet`,
      body: 'Drop in the course outline and every date and weight fills itself in. It takes about ten seconds.',
      cta: 'Add the outline', to: `/app/courses/${s.emptyCourse.id}`,
      reason: 'a current course has no assessments',
    })
  }

  // Deliberately NO "enter a grade" nudge. Entering grades is the premise of
  // the product; telling people how reads as a tutorial, not a discovery.

  if (s.weakest && s.weakest.percent < 65) {
    add({
      id: 'grade-needed', icon: 'target', score: 86,
      title: `What do you need in ${s.weakest.code}?`,
      body: `You are at ${Math.round(s.weakest.percent)}% so far. See the exact average you need on what is left to pass, or to hit the grade you want.`,
      cta: 'Do the math', to: `/app/courses/${s.weakest.id}`,
      reason: `standing below 65% in ${s.weakest.code}`,
    })
  } else if (s.gradedCount > 0 && s.weakest) {
    add({
      id: 'grade-needed', icon: 'target', score: 44,
      title: 'See what you need on the final',
      body: 'Pick the grade you want and see the average you need on everything that is left.',
      cta: 'Try it', to: `/app/courses/${s.weakest.id}`,
      reason: 'has grades, has not been shown the calculator',
    })
  }

  if (s.pastCourses === 0) {
    add({
      id: 'past', icon: 'history', score: s.currentCourses > 0 ? 82 : 60,
      title: 'Add your past semesters',
      body: 'Put in the classes you already finished and you get your whole GPA, your credits so far, and course recommendations based on what you have actually taken.',
      cta: 'Add past courses', to: '/app/courses?tab=past',
      reason: 'no finished courses on record',
    })
  }

  if (s.gpa !== null && s.gradedCount > 0) {
    const low = s.gpa < 2.7
    add({
      id: 'what-if', icon: 'trend', score: (low ? 84 : 48) * (s.pro ? 1 : 0.85),
      title: low ? 'See how to pull your GPA up' : 'Play with your GPA',
      body: 'Slide a course grade up or down and watch what it does to your GPA before it happens.',
      cta: 'Open the what-if', to: s.weakest ? `/app/courses/${s.weakest.id}` : '/app/courses',
      reason: low ? `GPA ${s.gpa.toFixed(2)} is under 2.70` : 'has a GPA, has not tried the what-if',
    })
  }

  if (s.upcomingDated >= 2 && !s.hasReminders) {
    add({
      id: 'reminders', icon: 'bell', score: 64,
      title: 'Get a nudge before things are due',
      body: 'Turn on reminders once and every deadline pings you ahead of time, on your phone or your laptop.',
      cta: 'Turn on reminders', to: '/app?settings=general',
      reason: 'has upcoming deadlines and no reminders',
    })
  }

  if (s.personalTasks === 0 && s.currentCourses > 0) {
    add({
      id: 'tasks', icon: 'tasks', score: 34,
      title: 'Not everything is an assignment',
      body: 'Add your own tasks, with a checklist or a repeat, and they sit beside your deadlines.',
      cta: 'Add a task', to: '/app/calendar',
      reason: 'no personal tasks yet',
    })
  }

  // Everything below needs the usage read, and most of it is Concordia-only.
  if (!u) return out

  if (s.atConcordia && !u.moodle) {
    add({
      id: 'moodle', icon: 'moodle', score: 78,
      title: 'Bring in your Moodle deadlines',
      body: 'Paste one link and the deadlines your profs post on Moodle show up here on their own, and stay in sync.',
      cta: 'Connect Moodle', to: '/app?settings=moodle',
      reason: 'Moodle is not connected',
    })
  }
  if (s.atConcordia && !u.programme) {
    add({
      id: 'programme', icon: 'degree', score: s.pastCourses > 0 ? 73 : 58,
      title: 'How far are you into your degree?',
      body: 'Pick your programme and see which required courses you have done and what is left.',
      cta: 'Set my programme', to: '/app/planner?tab=program',
      reason: 'no programme chosen',
    })
  }
  if (s.atConcordia && !u.schedule) {
    add({
      id: 'schedule', icon: 'schedule', score: registering ? 76 : 40,
      title: registering ? 'Build next term before seats go' : 'Try the schedule builder',
      body: 'Pick your courses and see every section that fits on one week, with conflicts caught for you.',
      cta: 'Build a schedule', to: '/app/planner?tab=schedule',
      reason: registering ? 'registration month and no saved schedule' : 'no saved schedule',
    })
  }
  if (s.atConcordia && !u.seat_watch) {
    add({
      id: 'seat-watch', icon: 'seat', score: registering ? 62 : 25,
      title: 'Class full? We will watch it',
      body: 'Pick a full section and get a notification the moment a seat opens.',
      cta: 'Watch a section', to: '/app/planner?tab=seats',
      reason: registering ? 'registration month, no seat watch' : 'no seat watch',
    })
  }
  if (!u.calendar_sync && s.upcomingDated >= 3) {
    add({
      id: 'calendar-sync', icon: 'calendar', score: s.pro ? 66 : 38,
      title: 'Put your deadlines in your phone calendar',
      body: 'One link and Google or Apple Calendar shows every deadline, and updates when a date moves.',
      cta: 'Set it up', to: '/app?settings=calendarSync',
      reason: 'several dated deadlines and no calendar sync',
    })
  }
  if (!u.clubs) {
    add({
      id: 'clubs', icon: 'clubs', score: 42,
      title: 'See what is happening on campus',
      body: 'Follow a club and its events land in your feed. Add one to your calendar in a tap.',
      cta: 'Browse events', to: '/app/community?c=events',
      reason: 'follows no clubs',
    })
  }
  if (!u.notes && s.desktop) {
    add({
      id: 'notes', icon: 'notes', score: 36,
      title: 'Take class notes next to your deadlines',
      body: 'Each class gets its own notebook. Notes link themselves to the right week.',
      cta: 'Open Notes', to: '/app/notes',
      reason: 'has not written a note',
    })
  }
  if (!u.family) {
    add({
      id: 'family', icon: 'family', score: 18,
      title: 'Parents asking what is due?',
      body: 'Send them a view-only link. They see deadlines, never your messages, and you choose if grades show.',
      cta: 'Set up family access', to: '/app?settings=family',
      reason: 'no family link',
    })
  }
  return out
}

/** Candidates this person may still be shown, best first. */
export function rank(s: DiscoverySignals, state: DiscoveryState, now: number): Nudge[] {
  const dismissed = new Set(state.dismissed ?? [])
  const tried = new Set(state.tried ?? [])
  return candidates(s)
    .filter((n) => !dismissed.has(n.id) && !tried.has(n.id))
    .filter((n) => {
      const until = state.snoozed?.[n.id]
      return !until || new Date(until).getTime() <= now
    })
    .sort((a, b) => b.score - a.score)
}

const DAY = 86_400_000

/**
 * The popup, if one is due. Rules, all of them about not being annoying:
 *   - never on someone's first day (they are still finding the front door)
 *   - never a feature a popup already showed
 *   - only things that genuinely apply (score 50+)
 *   - the gap grows: 1 day after the first, then 2, 3, capped at 5 days
 */
export function popupFor(s: DiscoverySignals, state: DiscoveryState, visitDays: number, now: number): Nudge | null {
  if (visitDays < 2) return null
  const popped = state.popped ?? {}
  const count = Object.keys(popped).length
  if (state.lastPop) {
    const gap = Math.min(1 + count - 1, 5) * DAY
    if (now - new Date(state.lastPop).getTime() < Math.max(gap, DAY) - 4 * 3_600_000) return null
  }
  return rank(s, state, now).find((n) => n.score >= 50 && !popped[n.id]) ?? null
}

/**
 * The Today card: the best nudge. Never on a day a popup has shown: two
 * "try this" surfaces at once is one too many.
 */
export function cardFor(s: DiscoverySignals, state: DiscoveryState, now: number): Nudge | null {
  if (state.lastPop && now - new Date(state.lastPop).getTime() < 18 * 3_600_000) return null
  return rank(s, state, now)[0] ?? null
}
