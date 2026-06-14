import type { Assessment, Course, User } from './types'
import { daysFromNow } from '@/lib/date'

/**
 * THE single mock-data module (in-memory only — no backend, no persistence).
 * Dates are seeded RELATIVE to the runtime clock (via `daysFromNow`) so the
 * "overdue / due this week" story is always true whenever the demo is opened.
 *
 * NOTE: `plan` starts as 'free' so the free-vs-paid line and the contextual
 * paywall nudge are demonstrable. A dev toggle flips it to 'semester'.
 */
export const currentUser: User = {
  name: 'Alex Degryse',
  email: 'alex.degryse@live.concordia.ca',
  initials: 'AD',
  plan: 'free',
}

export const courses: Course[] = [
  { id: 'comm217', code: 'COMM 217', title: 'Financial Accounting', term: 'Summer 2026', credits: 3 },
  { id: 'comp248', code: 'COMP 248', title: 'Object-Oriented Programming I', term: 'Summer 2026', credits: 3.5 },
  { id: 'math205', code: 'MATH 205', title: 'Differential & Integral Calculus II', term: 'Summer 2026', credits: 3 },
  { id: 'engl233', code: 'ENGL 233', title: 'Introduction to Fiction', term: 'Summer 2026', credits: 3 },
  { id: 'poli202', code: 'POLI 202', title: 'Introduction to Political Science', term: 'Summer 2026', credits: 3 },
]

/** Seed assessments. The AppDataProvider clones this so toggling "done" in the
 * UI never mutates the module-level seed. */
export const seedAssessments: Assessment[] = [
  // --- Graded / done — feed the GPA ---
  { id: 'comm217-q1', courseId: 'comm217', title: 'Quiz 1 — The accounting cycle', kind: 'quiz', due: daysFromNow(-20), weight: 5, provenance: { status: 'official' }, score: 88, done: true },
  { id: 'comm217-a1', courseId: 'comm217', title: 'Assignment 1 — Journal entries', kind: 'assignment', due: daysFromNow(-10), weight: 10, provenance: { status: 'confirmed', confirmations: 3 }, score: 82, done: true },
  { id: 'comp248-l1', courseId: 'comp248', title: 'Lab 1 — Setup & first class', kind: 'lab', due: daysFromNow(-18), weight: 5, provenance: { status: 'official' }, score: 95, done: true },
  { id: 'comp248-a1', courseId: 'comp248', title: 'Assignment 1 — Methods & arrays', kind: 'assignment', due: daysFromNow(-8), weight: 10, provenance: { status: 'official' }, score: 90, done: true },
  { id: 'math205-q1', courseId: 'math205', title: 'Quiz 1 — Integration techniques', kind: 'quiz', due: daysFromNow(-15), weight: 8, provenance: { status: 'official' }, score: 74, done: true },
  { id: 'engl233-r1', courseId: 'engl233', title: 'Reading response 1 — Chopin', kind: 'reading', due: daysFromNow(-12), weight: 5, provenance: { status: 'unverified' }, score: 86, done: true },
  { id: 'poli202-p1', courseId: 'poli202', title: 'Response paper 1 — Social contract', kind: 'assignment', due: daysFromNow(-9), weight: 10, provenance: { status: 'confirmed', confirmations: 5 }, score: 79, done: true },

  // --- Overdue, not done ---
  { id: 'engl233-r2', courseId: 'engl233', title: 'Reading response 2 — Hemingway', kind: 'reading', due: daysFromNow(-2), weight: 5, provenance: { status: 'unverified' }, score: null, done: false },
  { id: 'poli202-d1', courseId: 'poli202', title: 'Discussion post — Federalism', kind: 'assignment', due: daysFromNow(-1), weight: 5, provenance: { status: 'confirmed', confirmations: 4 }, score: null, done: false },

  // --- Due this week, not done (the midterm crunch) ---
  { id: 'comm217-mid', courseId: 'comm217', title: 'Midterm exam', kind: 'midterm', due: daysFromNow(1), weight: 25, provenance: { status: 'official' }, score: null, done: false },
  { id: 'comp248-a2', courseId: 'comp248', title: 'Assignment 2 — Inheritance', kind: 'assignment', due: daysFromNow(2), weight: 10, provenance: { status: 'confirmed', confirmations: 6 }, score: null, done: false },
  { id: 'math205-mid', courseId: 'math205', title: 'Midterm exam', kind: 'midterm', due: daysFromNow(3), weight: 30, provenance: { status: 'official' }, score: null, done: false },
  { id: 'engl233-e1', courseId: 'engl233', title: 'Essay draft — Close reading', kind: 'project', due: daysFromNow(4), weight: 15, provenance: { status: 'unverified' }, score: null, done: false },
  { id: 'comp248-l2', courseId: 'comp248', title: 'Lab 2 — Debugging clinic', kind: 'lab', due: daysFromNow(5), weight: 5, provenance: { status: 'official' }, score: null, done: false },
  { id: 'poli202-q1', courseId: 'poli202', title: 'Reading quiz — Comparative systems', kind: 'quiz', due: daysFromNow(6), weight: 5, provenance: { status: 'confirmed', confirmations: 3 }, score: null, done: false },

  // --- Beyond this week (finals) — context for later screens, off Today ---
  { id: 'comm217-fin', courseId: 'comm217', title: 'Final exam', kind: 'final', due: daysFromNow(25), weight: 35, provenance: { status: 'official' }, score: null, done: false },
  { id: 'comp248-proj', courseId: 'comp248', title: 'Final project — Console app', kind: 'project', due: daysFromNow(28), weight: 30, provenance: { status: 'official' }, score: null, done: false },
  { id: 'math205-fin', courseId: 'math205', title: 'Final exam', kind: 'final', due: daysFromNow(30), weight: 40, provenance: { status: 'official' }, score: null, done: false },
]
