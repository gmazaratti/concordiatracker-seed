/**
 * Domain types for the single in-memory mock-data module.
 * Grows as screens land (courses, assessments, events, provenance…).
 */

export type Plan = 'free' | 'semester'

export interface User {
  name: string
  email: string
  initials: string
  /** Google profile picture URL (from sign-in), if any. */
  avatarUrl?: string
  /** Public handle (set in onboarding) — shown on feedback posts as @handle. */
  handle?: string
  plan: Plan
  /** School / faculty (set in Settings) — drives the Community "for your program"
   * relevance. Editable in-session. */
  school: string
  /** Major / program of study (set in Settings). */
  program: string
}

/**
 * Provenance is first-class: every date the product surfaces carries where it
 * came from. `official` = pulled from a syllabus/registrar; `confirmed` = a
 * student-entered date corroborated by N classmates; `unverified` = entered by
 * one person, treat with caution.
 */
export type ProvenanceStatus = 'official' | 'confirmed' | 'unverified'

export interface Provenance {
  status: ProvenanceStatus
  /** How many classmates corroborated — only meaningful for `confirmed`. */
  confirmations?: number
}

export type AssessmentKind =
  | 'assignment'
  | 'quiz'
  | 'midterm'
  | 'final'
  | 'lab'
  | 'reading'
  | 'project'

/**
 * Lifecycle / timeliness of an assessment. Shared by Today (which surfaces only
 * the lightweight done/late/missed transitions) and the Courses grade editor
 * (which can set any of these). `not-started` and `extension` are still "open"
 * — i.e. they need action and appear on Today's due list.
 */
export type AssessmentStatus =
  | 'not-started'
  | 'in-progress'
  | 'done'
  | 'late'
  | 'missed'
  | 'extension'
  | 'awaiting-grade'

/** How a grade was entered. */
export type GradeMode = 'percent' | 'raw'

/**
 * A grade accepts either a direct percentage OR a raw score (earned / total,
 * e.g. 12/15) that derives a percentage. Both forms live here so the editor can
 * round-trip exactly what the student typed; use `gradeToPercent` to read it.
 */
export interface Grade {
  mode: GradeMode
  /** Used when `mode === 'percent'`. */
  percent: number | null
  /** Used when `mode === 'raw'` (earned out of total). */
  earned: number | null
  total: number | null
}

export interface Assessment {
  id: string
  courseId: string
  title: string
  kind: AssessmentKind
  /** ISO 8601 due timestamp. */
  due: string
  /** Percentage of the final grade this is worth (0–100). */
  weight: number
  provenance: Provenance
  status: AssessmentStatus
  /** Present once graded; `null` while outstanding or awaiting a grade. */
  grade: Grade | null
  /** Free-form per-assessment notes (edited in Courses). */
  notes: string
}

/** A personal calendar task/note the user adds (the "My calendar" layer, beyond
 * assignment deadlines). In-memory only, like everything else in the seed. */
export interface CalendarTask {
  id: string
  title: string
  /** ISO 8601 timestamp the task is pinned to. */
  due: string
  done: boolean
  note?: string
}

/** A teaching contact — instructor or TA. Editable inline on the course detail. */
export interface Contact {
  name: string
  email: string
}

export interface Course {
  id: string
  code: string
  title: string
  term: string
  credits: number
  /** Class accent color — an id into `COURSE_COLORS` (lib/course-color). Editable
   * in-session, the Google-Classroom-style per-class color. */
  color: string
  /** Logistics shown (and inline-editable) in the course-detail side panel. */
  section: string
  instructor: Contact
  /** Some classes list no TA — then this is null. */
  ta: Contact | null
  /** Building + room, e.g. "MB 3.430". */
  location: string
  /** Meeting schedule, e.g. "Mon · Wed 10:15–11:30". */
  meetingTimes: string
  /** Instructor office hours, e.g. "Tue 14:00–16:00 · MB 12.225". Optional —
   * teachers set this from the portal; students see it in the course panel. */
  officeHours?: string
  /** Syllabus link (mock — an external URL the student pasted). */
  syllabusUrl: string
  /** How the class entered the app. `manual` = the student created it by hand
   * (vs the seeded catalog) → the detail view leads with the fill-by-hand editor
   * and lets the code/name be edited. Omitted for seeded courses. */
  origin?: 'manual'
}
