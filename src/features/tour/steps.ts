import type { TourStep } from './tour'

/**
 * The guided walkthrough — a calm, ordered tour through every tab (Today →
 * Courses → a course → Calendar → Community), pointing the spotlight at the real
 * UI and explaining what each piece does. It runs against a throwaway DEMO 101
 * sandbox course (merged in by TourProvider, removed at the end) so it never
 * touches the user's real classes and works the same on an empty account.
 *
 * Steps are pure data — edit copy / order / targets here without touching the
 * engine. `route` is where the engine navigates first; omit `target` for a
 * centered explainer card.
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    route: '/app',
    type: 'read',
    title: 'Welcome — the 2-minute tour',
    body: "I've added a temporary “DEMO 101” course just for this walkthrough — your real classes are untouched, and it disappears when we're done. Use Next or →, and Esc to skip anytime.",
  },
  {
    id: 'today-glance',
    target: '[data-tour="glance"]',
    route: '/app',
    type: 'read',
    title: 'Today is your launchpad',
    body: 'This panel is your at-a-glance: current GPA, what’s due this week, and what’s coming next — so the first thing you see each day is what actually matters.',
  },
  {
    id: 'today-done',
    target: '[data-coach="mark-done"]',
    route: '/app',
    type: 'read',
    title: 'Check things off',
    body: 'Every task has a circle — tap it to mark it done. It slides into “Completed today” with an undo, and your progress updates instantly.',
  },
  {
    id: 'today-customize',
    target: '[data-tour="customize"]',
    route: '/app',
    type: 'read',
    title: 'Make Today yours',
    body: 'Group your list by time or by course, show or hide weights, and switch density — Today bends to how you like to work.',
  },
  {
    id: 'courses-import',
    target: '[data-tour="import-course"]',
    route: '/app/courses',
    type: 'read',
    title: 'Add a class',
    body: 'Import a syllabus, pick a classmate’s or professor’s blueprint, or enter one by hand. Every deadline, weight, and grade flows from here.',
  },
  {
    id: 'course-open',
    route: '/app/courses/sample-course',
    type: 'read',
    title: 'Inside a course',
    body: 'Open any class to manage it. This is our DEMO course — let’s walk through what each part does.',
  },
  {
    id: 'course-assessments',
    target: '[data-tour="assess-editor"]',
    route: '/app/courses/sample-course',
    type: 'read',
    title: 'Your assignments',
    body: 'Open the editor to add assignments or change a status, grade, or note. Each row also has a ⋮ menu for quick edits — same mark-done circle as Today.',
  },
  {
    id: 'course-breakdown',
    target: '[data-tour="breakdown"]',
    route: '/app/courses/sample-course',
    type: 'read',
    title: 'How your grade is built',
    body: 'See every category, its weight, and your average — with a “How is this calculated?” breakdown so the number is never a mystery.',
  },
  {
    id: 'course-grade-needed',
    target: '[data-tour="grade-needed"]',
    route: '/app/courses/sample-course',
    type: 'read',
    title: 'Grade calculator — free',
    body: 'Pick a target grade and see the exact average you need on what’s left. Real arithmetic, no guessing — and it’s free, forever.',
  },
  {
    id: 'course-gpa',
    target: '[data-tour="gpa-predict"]',
    route: '/app/courses/sample-course',
    type: 'read',
    title: 'Predict your GPA — Pro',
    body: 'Drag a what-if grade and watch your projected course % and overall GPA move live. This one’s part of the Semester pass.',
  },
  {
    id: 'course-info',
    target: '[data-tour="course-info"]',
    route: '/app/courses/sample-course',
    type: 'read',
    title: 'Class details',
    body: 'Instructor, section, office hours, room — all here and editable inline, so the practical stuff is one tap away.',
  },
  {
    id: 'calendar',
    target: '[data-tour="calendar-rail"]',
    route: '/app/calendar',
    type: 'read',
    title: 'Everything on one calendar',
    body: 'Toggle your personal deadlines and the university’s academic dates as layers, and switch between Month, Week, and Agenda views.',
  },
  {
    id: 'community-following',
    target: '[data-tour="following"]',
    route: '/app/community',
    type: 'read',
    title: 'What’s on campus',
    body: 'Follow clubs and orgs to get their events. Community is a calm, read-only events feed — never a social network.',
  },
  {
    id: 'community-add',
    target: '[data-tour="event-add"]',
    route: '/app/community',
    type: 'read',
    title: 'Save events you like',
    body: 'Add any event to your calendar with one tap, or open a host’s profile to see everything they’re putting on.',
  },
  {
    id: 'done',
    route: '/app',
    type: 'read',
    title: 'That’s the tour 🎉',
    body: 'The DEMO course is gone now — back to your real stuff. The “Getting started” card tracks your first steps, and you can replay this anytime from the menu.',
  },
]
