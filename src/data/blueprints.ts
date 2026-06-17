import type { Assessment, AssessmentKind, Provenance } from './types'
import { daysFromNow } from '@/lib/date'

/**
 * Mock blueprint marketplace — shared, importable syllabus outlines per course.
 * Credibility is several SEPARATE axes: POPULARITY (net upvotes), ADOPTION
 * (import count), RECENCY (term + upload date). Blueprints are scoped to a
 * SECTION — different sections of the same class can have different due dates.
 *
 * PROVENANCE: there's no ground truth to check a community upload against at
 * upload time, so community dates carry NO per-date "confirmed" claim — they're
 * `unverified` (single-source), and votes are the community-credibility signal.
 * Only a teacher-verified blueprint's dates are `official`; that's conveyed by
 * the verified badge, not repeated per date.
 */
export interface BlueprintDate {
  title: string
  kind: AssessmentKind
  weight: number
  /** ISO due timestamp (runtime-relative, like the rest of the seed). */
  due: string
  /** `official` only on teacher-verified blueprints; community = `unverified`. */
  provenance: Provenance
}

export interface Blueprint {
  id: string
  courseId: string
  /** Which section this outline is for — sections can have different dates. */
  section: string
  /** The professor who taught this section (context for "is this my prof?"). */
  instructor: string
  /** Which term it was uploaded for, e.g. "Summer 2026". */
  term: string
  teacherVerified: boolean
  /** Teacher name, or a student handle like "@maya.codes". */
  author: string
  upvotes: number
  downvotes: number
  /** How many students have imported this blueprint (adoption). */
  imports: number
  uploadedDaysAgo: number
  dates: BlueprintDate[]
}

const off: Provenance = { status: 'official' }
const uv: Provenance = { status: 'unverified' }

export const BLUEPRINTS: Blueprint[] = [
  // ── COMP 248 · section BB — teacher-verified pins; community collapse ──
  {
    id: 'comp248-bb-official', courseId: 'comp248', section: 'BB', instructor: 'Dr. Aiman Hanna',
    term: 'Summer 2026', teacherVerified: true, author: 'Dr. Aiman Hanna',
    upvotes: 64, downvotes: 1, imports: 412, uploadedDaysAgo: 38,
    dates: [
      { title: 'Lab 1 — Environment setup', kind: 'lab', weight: 5, due: daysFromNow(-18), provenance: off },
      { title: 'Assignment 1 — Methods & arrays', kind: 'assignment', weight: 10, due: daysFromNow(-8), provenance: off },
      { title: 'Assignment 2 — Inheritance', kind: 'assignment', weight: 10, due: daysFromNow(2), provenance: off },
      { title: 'Midterm exam', kind: 'midterm', weight: 25, due: daysFromNow(9), provenance: off },
      { title: 'Final project — Console app', kind: 'project', weight: 20, due: daysFromNow(28), provenance: off },
      { title: 'Final exam', kind: 'final', weight: 30, due: daysFromNow(40), provenance: off },
    ],
  },
  {
    id: 'comp248-bb-c1', courseId: 'comp248', section: 'BB', instructor: 'Dr. Aiman Hanna',
    term: 'Summer 2026', teacherVerified: false, author: '@maya.codes',
    upvotes: 28, downvotes: 3, imports: 156, uploadedDaysAgo: 21,
    dates: [
      { title: 'Assignment 1 — Arrays', kind: 'assignment', weight: 10, due: daysFromNow(-8), provenance: uv },
      { title: 'Assignment 2 — Inheritance', kind: 'assignment', weight: 10, due: daysFromNow(2), provenance: uv },
      { title: 'Midterm', kind: 'midterm', weight: 25, due: daysFromNow(9), provenance: uv },
      { title: 'Final project', kind: 'project', weight: 25, due: daysFromNow(28), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 30, due: daysFromNow(40), provenance: uv },
    ],
  },
  {
    id: 'comp248-bb-c2', courseId: 'comp248', section: 'BB', instructor: 'Dr. Aiman Hanna',
    term: 'Summer 2026', teacherVerified: false, author: '@devon.r',
    upvotes: 15, downvotes: 6, imports: 73, uploadedDaysAgo: 30,
    dates: [
      { title: 'Assignment 2 — Inheritance', kind: 'assignment', weight: 10, due: daysFromNow(2), provenance: uv },
      { title: 'Midterm', kind: 'midterm', weight: 25, due: daysFromNow(9), provenance: uv },
      { title: 'Final project', kind: 'project', weight: 25, due: daysFromNow(28), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 30, due: daysFromNow(40), provenance: uv },
    ],
  },
  {
    id: 'comp248-bb-c3', courseId: 'comp248', section: 'BB', instructor: 'Dr. Aiman Hanna',
    term: 'Winter 2026', teacherVerified: false, author: '@sam.le',
    upvotes: 9, downvotes: 4, imports: 28, uploadedDaysAgo: 95,
    dates: [
      { title: 'Assignment 1', kind: 'assignment', weight: 10, due: daysFromNow(-8), provenance: uv },
      { title: 'Midterm', kind: 'midterm', weight: 25, due: daysFromNow(9), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 30, due: daysFromNow(40), provenance: uv },
    ],
  },

  // ── COMP 248 · section BC — different prof, different dates, no teacher ──
  {
    id: 'comp248-bc-c1', courseId: 'comp248', section: 'BC', instructor: 'Dr. Nora Houari',
    term: 'Summer 2026', teacherVerified: false, author: '@jordan.p',
    upvotes: 19, downvotes: 2, imports: 41, uploadedDaysAgo: 18,
    dates: [
      { title: 'Lab 1 — Setup', kind: 'lab', weight: 5, due: daysFromNow(-15), provenance: uv },
      { title: 'Assignment 1 — Methods', kind: 'assignment', weight: 12, due: daysFromNow(-4), provenance: uv },
      { title: 'Midterm exam', kind: 'midterm', weight: 28, due: daysFromNow(12), provenance: uv },
      { title: 'Final project', kind: 'project', weight: 25, due: daysFromNow(31), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 30, due: daysFromNow(43), provenance: uv },
    ],
  },
  {
    id: 'comp248-bc-c2', courseId: 'comp248', section: 'BC', instructor: 'Dr. Nora Houari',
    term: 'Summer 2026', teacherVerified: false, author: '@kev.m',
    upvotes: 6, downvotes: 1, imports: 12, uploadedDaysAgo: 9,
    dates: [
      { title: 'Assignment 1', kind: 'assignment', weight: 12, due: daysFromNow(-4), provenance: uv },
      { title: 'Midterm', kind: 'midterm', weight: 28, due: daysFromNow(12), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 30, due: daysFromNow(43), provenance: uv },
    ],
  },

  // ── MATH 205 · section C — no teacher; community ranked by net votes ──
  {
    id: 'math205-c-c1', courseId: 'math205', section: 'C', instructor: 'Dr. Galia Dafni',
    term: 'Summer 2026', teacherVerified: false, author: '@calc.queen',
    upvotes: 41, downvotes: 2, imports: 188, uploadedDaysAgo: 16,
    dates: [
      { title: 'Quiz 1 — Integration techniques', kind: 'quiz', weight: 8, due: daysFromNow(-15), provenance: uv },
      { title: 'Quiz 2 — Sequences & series', kind: 'quiz', weight: 8, due: daysFromNow(1), provenance: uv },
      { title: 'Midterm exam', kind: 'midterm', weight: 30, due: daysFromNow(3), provenance: uv },
      { title: 'Assignment — Improper integrals', kind: 'assignment', weight: 15, due: daysFromNow(12), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 39, due: daysFromNow(30), provenance: uv },
    ],
  },
  {
    id: 'math205-c-c2', courseId: 'math205', section: 'C', instructor: 'Dr. Galia Dafni',
    term: 'Summer 2026', teacherVerified: false, author: '@profs.helper',
    upvotes: 22, downvotes: 5, imports: 64, uploadedDaysAgo: 25,
    dates: [
      { title: 'Midterm exam', kind: 'midterm', weight: 30, due: daysFromNow(3), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 40, due: daysFromNow(30), provenance: uv },
      { title: 'Quiz 1', kind: 'quiz', weight: 8, due: daysFromNow(-15), provenance: uv },
      { title: 'Quiz 2', kind: 'quiz', weight: 8, due: daysFromNow(1), provenance: uv },
      { title: 'Assignment', kind: 'assignment', weight: 14, due: daysFromNow(12), provenance: uv },
    ],
  },
  {
    id: 'math205-c-c3', courseId: 'math205', section: 'C', instructor: 'Dr. Galia Dafni',
    term: 'Winter 2026', teacherVerified: false, author: '@nightowl',
    upvotes: 7, downvotes: 9, imports: 19, uploadedDaysAgo: 110,
    dates: [
      { title: 'Final exam', kind: 'final', weight: 40, due: daysFromNow(30), provenance: uv },
      { title: 'Midterm', kind: 'midterm', weight: 30, due: daysFromNow(3), provenance: uv },
      { title: 'Quiz', kind: 'quiz', weight: 8, due: daysFromNow(1), provenance: uv },
    ],
  },

  // ── HIST 203 · section AA — community; the empty-course import target ──
  {
    id: 'hist203-aa-c1', courseId: 'hist203', section: 'AA', instructor: 'Dr. Gavin Taylor',
    term: 'Summer 2026', teacherVerified: false, author: '@history.buff',
    upvotes: 33, downvotes: 1, imports: 97, uploadedDaysAgo: 9,
    dates: [
      { title: 'Reading response — Confederation debates', kind: 'reading', weight: 10, due: daysFromNow(3), provenance: uv },
      { title: 'Map quiz — Provinces & territories', kind: 'quiz', weight: 10, due: daysFromNow(8), provenance: uv },
      { title: 'Midterm exam', kind: 'midterm', weight: 25, due: daysFromNow(16), provenance: uv },
      { title: 'Primary-source analysis', kind: 'assignment', weight: 10, due: daysFromNow(22), provenance: uv },
      { title: 'Research essay — Post-war Canada', kind: 'project', weight: 20, due: daysFromNow(34), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 25, due: daysFromNow(46), provenance: uv },
    ],
  },
  {
    id: 'hist203-aa-c2', courseId: 'hist203', section: 'AA', instructor: 'Dr. Gavin Taylor',
    term: 'Winter 2026', teacherVerified: false, author: '@late.night.essays',
    upvotes: 6, downvotes: 3, imports: 14, uploadedDaysAgo: 88,
    dates: [
      { title: 'Reading response', kind: 'reading', weight: 10, due: daysFromNow(3), provenance: uv },
      { title: 'Map quiz', kind: 'quiz', weight: 10, due: daysFromNow(8), provenance: uv },
      { title: 'Midterm', kind: 'midterm', weight: 25, due: daysFromNow(16), provenance: uv },
      { title: 'Essay', kind: 'project', weight: 20, due: daysFromNow(34), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 25, due: daysFromNow(46), provenance: uv },
    ],
  },

  // ── HIST 203 · section AB — different prof + dates ──
  {
    id: 'hist203-ab-c1', courseId: 'hist203', section: 'AB', instructor: 'Dr. Steven High',
    term: 'Summer 2026', teacherVerified: false, author: '@archive.rat',
    upvotes: 11, downvotes: 0, imports: 22, uploadedDaysAgo: 12,
    dates: [
      { title: 'Reading response — Confederation', kind: 'reading', weight: 12, due: daysFromNow(5), provenance: uv },
      { title: 'Midterm exam', kind: 'midterm', weight: 28, due: daysFromNow(18), provenance: uv },
      { title: 'Oral history project', kind: 'project', weight: 25, due: daysFromNow(33), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 35, due: daysFromNow(48), provenance: uv },
    ],
  },

  // ── ENGL 233 · section AA — a single community blueprint ──
  {
    id: 'engl233-aa-c1', courseId: 'engl233', section: 'AA', instructor: 'Dr. Jason Camlot',
    term: 'Summer 2026', teacherVerified: false, author: '@lit.major',
    upvotes: 18, downvotes: 0, imports: 58, uploadedDaysAgo: 14,
    dates: [
      { title: 'Reading response 1 — Chopin', kind: 'reading', weight: 5, due: daysFromNow(-12), provenance: uv },
      { title: 'Reading response 2 — Hemingway', kind: 'reading', weight: 5, due: daysFromNow(-2), provenance: uv },
      { title: 'Close-reading essay', kind: 'project', weight: 15, due: daysFromNow(4), provenance: uv },
      { title: 'Research essay', kind: 'project', weight: 35, due: daysFromNow(24), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 40, due: daysFromNow(38), provenance: uv },
    ],
  },

  // ── POLI 202 · section D — teacher-verified pins; community collapse ──
  {
    id: 'poli202-d-official', courseId: 'poli202', section: 'D', instructor: 'Dr. Daniel Salée',
    term: 'Summer 2026', teacherVerified: true, author: 'Dr. Daniel Salée',
    upvotes: 47, downvotes: 0, imports: 263, uploadedDaysAgo: 33,
    dates: [
      { title: 'Response paper 1 — Social contract', kind: 'assignment', weight: 10, due: daysFromNow(-9), provenance: off },
      { title: 'Discussion post — Federalism', kind: 'assignment', weight: 5, due: daysFromNow(-1), provenance: off },
      { title: 'Reading quiz — Comparative systems', kind: 'quiz', weight: 5, due: daysFromNow(6), provenance: off },
      { title: 'Midterm exam', kind: 'midterm', weight: 30, due: daysFromNow(14), provenance: off },
      { title: 'Final exam', kind: 'final', weight: 50, due: daysFromNow(32), provenance: off },
    ],
  },
  {
    id: 'poli202-d-c1', courseId: 'poli202', section: 'D', instructor: 'Dr. Daniel Salée',
    term: 'Summer 2026', teacherVerified: false, author: '@polisci.nerd',
    upvotes: 12, downvotes: 1, imports: 44, uploadedDaysAgo: 19,
    dates: [
      { title: 'Midterm exam', kind: 'midterm', weight: 30, due: daysFromNow(14), provenance: uv },
      { title: 'Final exam', kind: 'final', weight: 50, due: daysFromNow(32), provenance: uv },
      { title: 'Response paper', kind: 'assignment', weight: 10, due: daysFromNow(-9), provenance: uv },
      { title: 'Reading quiz', kind: 'quiz', weight: 5, due: daysFromNow(6), provenance: uv },
    ],
  },

  // ── COMM 217 — intentionally NONE (empty-state demo) ──
]

export function netVotes(b: Blueprint): number {
  return b.upvotes - b.downvotes
}

export function blueprintsForCourse(courseId: string): Blueprint[] {
  return BLUEPRINTS.filter((b) => b.courseId === courseId)
}

/** Distinct sections that have blueprints for a course. */
export function sectionsForCourse(courseId: string): string[] {
  return [...new Set(blueprintsForCourse(courseId).map((b) => b.section))]
}

/** Sum of the blueprint's weights — how complete the outline is (≈100 = full). */
export function blueprintWeight(b: Blueprint): number {
  return b.dates.reduce((sum, d) => sum + d.weight, 0)
}

/** Materialize a blueprint into importable assessments for its course. Carries
 * each date's provenance through — official for teacher-verified, unverified for
 * community (honest: single-source until your classmates corroborate it). */
export function blueprintToAssessments(b: Blueprint): Assessment[] {
  return b.dates.map((d, i) => ({
    id: `${b.courseId}-bp-${b.id}-${i}`,
    courseId: b.courseId,
    title: d.title,
    kind: d.kind,
    due: d.due,
    weight: d.weight,
    provenance: d.provenance,
    status: 'not-started',
    grade: null,
    notes: '',
  }))
}

const UPLOAD_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** Absolute upload date, e.g. "May 28, 2026". */
export function uploadedOn(daysAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return UPLOAD_FMT.format(d)
}
