import type { TourStep } from './tour'

/**
 * DEPTH 1 — required first-run. Deliberately short + in-context: spotlight the two
 * "go here and do this" actions, then one card covering the rest. Edit these
 * freely (order, copy, targets) without touching the engine. The deep, optional
 * walkthrough (with the sandbox) is a separate FULL_TOUR array, added next.
 */
export const FIRST_RUN_STEPS: TourStep[] = [
  {
    id: 'import-course',
    target: '[data-tour="import-course"]',
    route: '/app/courses',
    type: 'read',
    title: 'Add your courses here',
    body: "Import a syllabus or pick a classmate's blueprint — your deadlines, weights, and grades all flow from this one place.",
  },
  {
    id: 'follow-community',
    target: '[data-tour="following"]',
    route: '/app/community',
    type: 'read',
    title: "Follow what's on campus",
    body: 'Follow clubs and orgs to get their events. Your follows live here — Community is a calm events feed, never a social network.',
  },
  {
    id: 'the-rest',
    route: '/app',
    type: 'read',
    title: 'Marking done, editing & your calendar',
    body: 'On Today (and inside a course) tap the circle to mark a task done, or tap a row to edit its date, grade, or notes. The Calendar tab shows every deadline, with your personal and university layers. That’s the whole loop.',
  },
]
