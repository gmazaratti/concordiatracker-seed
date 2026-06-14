/**
 * Domain types for the single in-memory mock-data module.
 * Grows as screens land (courses, assessments, events, provenance…).
 */

export type Plan = 'free' | 'semester'

export interface User {
  name: string
  email: string
  initials: string
  plan: Plan
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
  /** Earned percentage once graded; `null` while still outstanding. */
  score: number | null
  done: boolean
}

export interface Course {
  id: string
  code: string
  title: string
  term: string
  credits: number
}
