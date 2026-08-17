import { createContext, useContext } from 'react'
import type {
  Assessment,
  AssessmentStatus,
  CalendarTask,
  Course,
  Grade,
  Plan,
  User,
} from '@/data/types'
import type { PeerCorrection } from '@/data/peer-corrections'

/** The in-memory app store. Everything is mock + ephemeral: editing a status,
 * grade, or note — or flipping the plan — lives only for the session, matching
 * the seed's no-backend rule. These mutations are the shared write surface for
 * both Today (status only) and the Courses grade editor. */
/** How the Courses list lays out — dense rows or the Classroom-style card grid. */
export type CoursesView = 'list' | 'grid'

/** How the Community events feed lays out — rich cards or dense rows. */
export type CommunityView = 'card' | 'row'

/** "Customize Today" preferences — calm defaults, tailored per user. Sticky
 * across SPA nav (like `coursesView`), resets on reload. */
export interface TodayPrefs {
  /** Show each item's weight on the Today rows. */
  showWeight: boolean
  density: 'comfortable' | 'compact'
  /** Group the due list by time buckets (overdue / this week) or by course. */
  groupBy: 'time' | 'course'
  /** Power-user opt-in: re-show full provenance badges on Today. */
  showProvenance: boolean
}

export const DEFAULT_TODAY_PREFS: TodayPrefs = {
  showWeight: true,
  density: 'comfortable',
  groupBy: 'time',
  showProvenance: false,
}

/** Calendar view + which layers are on. Sticky across SPA nav, resets on reload. */
export interface CalendarPrefs {
  view: 'month' | 'week' | 'agenda'
  /** Concordia official academic calendar layer. */
  showConcordia: boolean
  /** Personal layer — assignment deadlines + tasks. */
  showMine: boolean
}

export const DEFAULT_CALENDAR_PREFS: CalendarPrefs = {
  view: 'month',
  showConcordia: true,
  showMine: true,
}

export interface AppDataContextValue {
  user: User
  plan: Plan
  setPlan: (plan: Plan) => void
  /** Optimistically apply a granted Pro window (ISO) — used by the survey reward
   * so the plan flips live after the server grant. */
  applyProUntil: (iso: string) => void
  /** Edit the signed-in user's profile (name / school / program) — persisted to
   * Supabase `user_profile`; read by Settings + Community ("for your program"). */
  updateProfile: (patch: Partial<{ name: string; school: string; program: string }>) => void
  /** Set the program from a canonical selection (id + display name); logs an
   * "Other" entry for review. */
  setProgram: (sel: { id: string; name: string }) => void
  /** Update public-profile privacy: the public toggle and/or bio. */
  updatePrivacy: (patch: { profilePublic?: boolean; bio?: string }) => void
  /** Whether the signed-in user finished onboarding. `null` = profile still
   * loading (the gate waits, so returning users never flash the app). */
  onboardingCompleted: boolean | null
  /** Save the onboarding profile (name/handle/program) + mark it complete.
   * `program` is the display name, `programId` the canonical id (or 'other').
   * Returns `error: 'handle-taken'` if the @handle is already in use. */
  completeOnboarding: (data: {
    name?: string
    handle?: string
    programId?: string
    program?: string
    profilePublic?: boolean
  }) => Promise<{ error: 'handle-taken' | 'save-failed' | null }>
  /** Change the @handle from Settings. The DB enforces a 14-day cooldown
   * (`error: 'cooldown'`) and uniqueness (`error: 'taken'`). */
  changeHandle: (
    next: string,
  ) => Promise<{ error: 'taken' | 'cooldown' | 'invalid' | 'save-failed' | null }>
  courses: Course[]
  assessments: Assessment[]
  /** True while the signed-in user's courses + assignments are still loading.
   * Lets a course-detail page wait instead of redirecting on a not-yet-loaded id. */
  dataLoading: boolean
  setStatus: (id: string, status: AssessmentStatus) => void
  setGrade: (id: string, grade: Grade | null) => void
  setNotes: (id: string, notes: string) => void
  /** Patch any fields of an assessment at once (the Edit modal — due, status,
   * grade, notes in one write). */
  updateAssessment: (id: string, patch: Partial<Assessment>) => void
  /** Append parsed assessments (the syllabus parse-reveal commits through here). */
  addAssessments: (items: Assessment[]) => void
  /** Remove an assessment from the in-memory store (the Today "Delete" action). */
  removeAssessment: (id: string) => void
  /** Recolor a class (the Google-Classroom per-class color). In-memory. */
  setCourseColor: (id: string, color: string) => void
  /** Inline-edit a course's logistics (instructor, TA, location, credits…). */
  updateCourse: (id: string, patch: Partial<Course>) => void
  /** Create a student-made course in Supabase. Blank for a manual add, or
   * pre-filled (code/title/section) when added from a blueprint. Returns its new
   * id (DB-generated). */
  createCourse: (init?: {
    code?: string
    title?: string
    section?: string
    /** From the catalogue, so a new course starts with the real credit value. */
    credits?: number
    /** A later term, for classes you are registered in but not yet taking.
     *  Defaults to the term you are running. */
    term?: string
  }) => Promise<string>
  /** Delete a course and all its assessments (the Courses card "Delete" action). */
  removeCourse: (id: string) => void

  // ── Academic history (past semesters) ───────────────────────────────────
  /** Courses from finished terms — the transcript. Kept OUT of `courses` so
   * Today / the grid / Calendar / GPA stay about the current term. */
  pastCourses: Course[]
  /** Finish a course: freezes its current grade onto the row, then moves it to
   * the transcript (so past-term GPA can never drift). */
  archiveCourse: (id: string) => void
  /** Undo an archive — back to the current term, grade unfrozen. */
  unarchiveCourse: (id: string) => void
  /** Add a course from before you used the app (no assessments). The grade is
   * OPTIONAL: without it the course still counts for credits and prerequisites
   * and is skipped by GPA. Returns the new id. */
  addPastCourse: (init: {
    code: string
    title: string
    term: string
    credits: number
    finalPercent?: number
    /** Overrides the derived letter, for notations like FNS. */
    finalLetter?: string
    /** False for an upcoming term: a plan, not history. */
    archived?: boolean
  }) => Promise<string>
  /** OPT-IN: publish a course's current outline to the shared blueprint pool
   * (the Courses card "Share as blueprint" action). Courses are private otherwise. */
  shareCourseAsBlueprint: (courseId: string) => Promise<void>
  /** Add a blank SELF-ENTERED assessment to a course (the manual editor). Lands
   * with `unverified` provenance. */
  addBlankAssessment: (courseId: string) => void
  courseById: (id: string) => Course | undefined
  /** Courses-list layout preference — sticky across SPA nav, resets on reload. */
  coursesView: CoursesView
  setCoursesView: (view: CoursesView) => void
  /** Community events layout preference — sticky across SPA nav, resets on reload. */
  communityView: CommunityView
  setCommunityView: (view: CommunityView) => void
  /** "Customize Today" preferences — sticky across SPA nav, resets on reload. */
  todayPrefs: TodayPrefs
  updateTodayPrefs: (patch: Partial<TodayPrefs>) => void

  /** Personal calendar tasks/notes (the "My calendar" layer). In-memory. */
  personalTasks: CalendarTask[]
  addTask: (task: { title: string; due: string; note?: string }) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void

  /** "Remind me" subscriptions for Community events (the detail button). STUB —
   * in-memory; real reminder delivery is CONNECTION-PHASE. */
  isReminderSet: (eventId: string) => boolean
  toggleReminder: (eventId: string) => void
  /** Calendar view + layer preferences — sticky across SPA nav. */
  calendarPrefs: CalendarPrefs
  updateCalendarPrefs: (patch: Partial<CalendarPrefs>) => void

  /** Pending peer date-corrections (the "Waze for academics" stub). In-memory. */
  peerCorrections: PeerCorrection[]
  /** Accept a crowd correction: moves the date + marks it confirmed-by-N, then
   * clears the suggestion. */
  applyPeerCorrection: (assessmentId: string) => void
  /** Dismiss a suggestion without changing the date. */
  dismissPeerCorrection: (assessmentId: string) => void
  /** Guided-tour sandbox: merge a throwaway DEMO course in (start) / remove it
   * (stop). In-memory only; writes to its ids are no-ops. */
  startSample: () => void
  stopSample: () => void
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within <AppDataProvider>')
  return ctx
}
