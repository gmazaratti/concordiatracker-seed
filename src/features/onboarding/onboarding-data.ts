import type { Assessment, AssessmentKind } from '@/data/types'

interface SampleAssessment {
  kind: AssessmentKind
  title: string
  weight: number
  /** Days from now the deadline falls — keeps the first course's dates UPCOMING
   * (so Today's payoff lands clean, not a wall of overdue items). */
  inDays: number
}

export interface OnboardCourse {
  code: string
  title: string
  instructor: string
  assessments: SampleAssessment[]
}

/** Curated real Concordia courses for the onboarding "add your first course"
 * step. COMM 221 mirrors the parse-reveal animation; the others are blueprint
 * picks. All dates are future-relative so the new course reads as upcoming. */
export const ONBOARD_COURSES: OnboardCourse[] = [
  {
    code: 'COMM 221',
    title: 'Financial Markets',
    instructor: 'John Molson School of Business',
    assessments: [
      { kind: 'quiz', title: 'Quiz 1 — Time value & NPV', weight: 8, inDays: 5 },
      { kind: 'quiz', title: 'Quiz 2 — Risk, CAPM & ESG', weight: 8, inDays: 12 },
      { kind: 'quiz', title: 'Quiz 3 — Markets & equilibria', weight: 8, inDays: 19 },
      { kind: 'quiz', title: 'Quiz 4 — Resource allocation', weight: 8, inDays: 26 },
      { kind: 'quiz', title: 'Quiz 5 — History & regulation', weight: 8, inDays: 33 },
      { kind: 'final', title: 'Final Common Exam', weight: 60, inDays: 45 },
    ],
  },
  {
    code: 'COMP 248',
    title: 'Object-Oriented Programming I',
    instructor: 'Dr. Aiman Hanna',
    assessments: [
      { kind: 'assignment', title: 'Assignment 1 — Java basics', weight: 10, inDays: 6 },
      { kind: 'quiz', title: 'Quiz 1 — Control flow', weight: 5, inDays: 11 },
      { kind: 'midterm', title: 'Midterm exam', weight: 25, inDays: 19 },
      { kind: 'assignment', title: 'Assignment 2 — Classes & objects', weight: 10, inDays: 27 },
      { kind: 'final', title: 'Final exam', weight: 50, inDays: 41 },
    ],
  },
  {
    code: 'POLI 202',
    title: 'Introduction to Political Science',
    instructor: 'Dr. Hélène Salée',
    assessments: [
      { kind: 'reading', title: 'Reading response 1', weight: 10, inDays: 7 },
      { kind: 'midterm', title: 'Midterm exam', weight: 30, inDays: 18 },
      { kind: 'project', title: 'Research essay', weight: 25, inDays: 30 },
      { kind: 'final', title: 'Final exam', weight: 35, inDays: 44 },
    ],
  },
]

const dayMs = 86_400_000

/** Shape a sample course into real Assessment rows for `addAssessments`. */
export function toAssessments(course: OnboardCourse, courseId: string): Assessment[] {
  return course.assessments.map((a) => ({
    id: crypto.randomUUID(),
    courseId,
    title: a.title,
    kind: a.kind,
    due: new Date(Date.now() + a.inDays * dayMs).toISOString(),
    weight: a.weight,
    provenance: { status: 'unverified' },
    status: 'not-started',
    grade: null,
    notes: '',
  }))
}
