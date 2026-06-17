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
  courses: Course[]
  assessments: Assessment[]
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
  courseById: (id: string) => Course | undefined
  /** Courses-list layout preference — sticky across SPA nav, resets on reload. */
  coursesView: CoursesView
  setCoursesView: (view: CoursesView) => void
  /** "Customize Today" preferences — sticky across SPA nav, resets on reload. */
  todayPrefs: TodayPrefs
  updateTodayPrefs: (patch: Partial<TodayPrefs>) => void

  /** Personal calendar tasks/notes (the "My calendar" layer). In-memory. */
  personalTasks: CalendarTask[]
  addTask: (task: { title: string; due: string; note?: string }) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
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
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within <AppDataProvider>')
  return ctx
}
