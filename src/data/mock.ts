import type { Assessment, CalendarTask, Course, User } from './types'
import { daysFromNow } from '@/lib/date'
import { percentGrade, rawGrade } from '@/lib/grade'

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
  school: 'Gina Cody School of Engineering & Computer Science',
  program: 'Computer Science',
}

/** The active term. Bounds are runtime-relative (like the due dates) so the
 * "Week X of Y" progress reads correctly whenever the demo is opened — today
 * lands ~6 weeks into a 13-week term. */
export const term = {
  name: 'Summer 2026',
  start: daysFromNow(-41, 0, 0),
  end: daysFromNow(50, 0, 0),
}

export const courses: Course[] = [
  {
    id: 'comm217',
    code: 'COMM 217',
    title: 'Financial Accounting',
    term: 'Summer 2026',
    credits: 3,
    color: 'teal',
    section: 'AA',
    instructor: { name: 'Dr. Hélène Tremblay', email: 'helene.tremblay@concordia.ca' },
    ta: { name: 'Marc Lavoie', email: 'marc.lavoie@mail.concordia.ca' },
    location: 'MB 3.430',
    meetingTimes: 'Mon · Wed 10:15–11:30',
    syllabusUrl: 'https://moodle.concordia.ca/comm217/syllabus.pdf',
  },
  {
    id: 'comp248',
    code: 'COMP 248',
    title: 'Object-Oriented Programming I',
    term: 'Summer 2026',
    credits: 3.5,
    color: 'blue',
    section: 'BB',
    instructor: { name: 'Dr. Aiman Hanna', email: 'aiman.hanna@concordia.ca' },
    ta: { name: 'Priya Nair', email: 'priya.nair@mail.concordia.ca' },
    location: 'H 937',
    meetingTimes: 'Tue · Thu 13:15–14:30',
    syllabusUrl: 'https://moodle.concordia.ca/comp248/outline.pdf',
  },
  {
    id: 'math205',
    code: 'MATH 205',
    title: 'Differential & Integral Calculus II',
    term: 'Summer 2026',
    credits: 3,
    color: 'purple',
    section: 'C',
    instructor: { name: 'Dr. Galia Dafni', email: 'galia.dafni@concordia.ca' },
    ta: null,
    location: 'LB 619',
    meetingTimes: 'Mon · Wed · Fri 09:00–09:50',
    syllabusUrl: 'https://moodle.concordia.ca/math205/syllabus.pdf',
  },
  {
    id: 'engl233',
    code: 'ENGL 233',
    title: 'Introduction to Fiction',
    term: 'Summer 2026',
    credits: 3,
    color: 'rose',
    section: 'AA',
    instructor: { name: 'Dr. Jason Camlot', email: 'jason.camlot@concordia.ca' },
    ta: { name: 'Sofia Russo', email: 'sofia.russo@mail.concordia.ca' },
    location: 'LB 646',
    meetingTimes: 'Tue · Thu 15:45–17:00',
    syllabusUrl: 'https://moodle.concordia.ca/engl233/reading-list.pdf',
  },
  {
    id: 'poli202',
    code: 'POLI 202',
    title: 'Introduction to Political Science',
    term: 'Summer 2026',
    credits: 3,
    color: 'amber',
    section: 'D',
    instructor: { name: 'Dr. Daniel Salée', email: 'daniel.salee@concordia.ca' },
    ta: { name: 'Owen Fitzgerald', email: 'owen.fitzgerald@mail.concordia.ca' },
    location: 'H 420',
    meetingTimes: 'Wed 18:00–20:30',
    syllabusUrl: 'https://moodle.concordia.ca/poli202/syllabus.pdf',
  },
  // Freshly added, no dates yet — the home of the syllabus parse-reveal hero.
  {
    id: 'hist203',
    code: 'HIST 203',
    title: 'Canada Since Confederation',
    term: 'Summer 2026',
    credits: 3,
    color: 'orange',
    section: 'AA',
    instructor: { name: 'Dr. Gavin Taylor', email: 'gavin.taylor@concordia.ca' },
    ta: null,
    location: 'MB 2.270',
    meetingTimes: 'Mon · Wed 14:45–16:00',
    syllabusUrl: 'https://moodle.concordia.ca/hist203/outline.pdf',
  },
]

/** Seed assessments. The AppDataProvider clones this so editing status/grades in
 * the UI never mutates the module-level seed. Grades are seeded in both entry
 * forms (raw score and percent) to exercise the shared model. */
export const seedAssessments: Assessment[] = [
  // --- Graded — feed the GPA (status resolved, grade present) ---
  { id: 'comm217-q1', courseId: 'comm217', title: 'Quiz 1 — The accounting cycle', kind: 'quiz', due: daysFromNow(-20), weight: 5, provenance: { status: 'official' }, status: 'done', grade: rawGrade(44, 50), notes: '' },
  { id: 'comm217-a1', courseId: 'comm217', title: 'Assignment 1 — Journal entries', kind: 'assignment', due: daysFromNow(-10), weight: 10, provenance: { status: 'confirmed', confirmations: 3 }, status: 'done', grade: percentGrade(82), notes: '' },
  { id: 'comp248-l1', courseId: 'comp248', title: 'Lab 1 — Setup & first class', kind: 'lab', due: daysFromNow(-18), weight: 5, provenance: { status: 'official' }, status: 'done', grade: rawGrade(19, 20), notes: '' },
  { id: 'comp248-a1', courseId: 'comp248', title: 'Assignment 1 — Methods & arrays', kind: 'assignment', due: daysFromNow(-8), weight: 10, provenance: { status: 'official' }, status: 'done', grade: rawGrade(45, 50), notes: '' },
  { id: 'math205-q1', courseId: 'math205', title: 'Quiz 1 — Integration techniques', kind: 'quiz', due: daysFromNow(-15), weight: 8, provenance: { status: 'official' }, status: 'done', grade: rawGrade(37, 50), notes: 'Lost marks on integration by parts — review for the midterm.' },
  { id: 'engl233-r1', courseId: 'engl233', title: 'Reading response 1 — Chopin', kind: 'reading', due: daysFromNow(-12), weight: 5, provenance: { status: 'unverified' }, status: 'late', grade: percentGrade(86), notes: 'Turned in a day late; prof waived the penalty.' },
  { id: 'poli202-p1', courseId: 'poli202', title: 'Response paper 1 — Social contract', kind: 'assignment', due: daysFromNow(-9), weight: 10, provenance: { status: 'confirmed', confirmations: 5 }, status: 'done', grade: percentGrade(79), notes: '' },

  // --- Overdue, still open ---
  { id: 'engl233-r2', courseId: 'engl233', title: 'Reading response 2 — Hemingway', kind: 'reading', due: daysFromNow(-2), weight: 5, provenance: { status: 'unverified' }, status: 'not-started', grade: null, notes: '' },
  { id: 'poli202-d1', courseId: 'poli202', title: 'Discussion post — Federalism', kind: 'assignment', due: daysFromNow(-1), weight: 5, provenance: { status: 'confirmed', confirmations: 4 }, status: 'not-started', grade: null, notes: '' },

  // --- Due this week, still open (the midterm crunch) ---
  { id: 'comm217-mid', courseId: 'comm217', title: 'Midterm exam', kind: 'midterm', due: daysFromNow(1), weight: 25, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'comp248-a2', courseId: 'comp248', title: 'Assignment 2 — Inheritance', kind: 'assignment', due: daysFromNow(2), weight: 10, provenance: { status: 'confirmed', confirmations: 6 }, status: 'not-started', grade: null, notes: '' },
  { id: 'math205-mid', courseId: 'math205', title: 'Midterm exam', kind: 'midterm', due: daysFromNow(3), weight: 30, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'engl233-e1', courseId: 'engl233', title: 'Essay draft — Close reading', kind: 'project', due: daysFromNow(4), weight: 15, provenance: { status: 'unverified' }, status: 'not-started', grade: null, notes: '' },
  { id: 'comp248-l2', courseId: 'comp248', title: 'Lab 2 — Debugging clinic', kind: 'lab', due: daysFromNow(5), weight: 5, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'poli202-q1', courseId: 'poli202', title: 'Reading quiz — Comparative systems', kind: 'quiz', due: daysFromNow(6), weight: 5, provenance: { status: 'confirmed', confirmations: 3 }, status: 'not-started', grade: null, notes: '' },

  // --- Beyond this week (finals) — context for later screens, off Today ---
  { id: 'comm217-fin', courseId: 'comm217', title: 'Final exam', kind: 'final', due: daysFromNow(25), weight: 35, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'comp248-proj', courseId: 'comp248', title: 'Final project — Console app', kind: 'project', due: daysFromNow(28), weight: 30, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'math205-fin', courseId: 'math205', title: 'Final exam', kind: 'final', due: daysFromNow(30), weight: 40, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
]

/** Seed personal calendar tasks/notes (the "My calendar" layer beyond
 * assignments). Cloned by the provider; dates are runtime-relative. */
export const seedTasks: CalendarTask[] = [
  { id: 'task-1', title: 'Office hours — COMP 248 Q&A', due: daysFromNow(1, 14, 0), done: false, note: 'Bring Assignment 2 questions.' },
  { id: 'task-2', title: 'Form study group for finals', due: daysFromNow(4, 17, 0), done: false },
  { id: 'task-3', title: 'Buy MATH 205 exam booklet', due: daysFromNow(-1, 12, 0), done: true },
]

/**
 * The scripted "parse" output for HIST 203 — what the syllabus parse-reveal
 * cascades into the empty course. NOT in `seedAssessments`: it lands in the
 * store only after the (mock) upload, so the empty → populated story is real.
 * Weights total 100; dates are runtime-relative like the rest of the seed.
 */
export const hist203Syllabus: Assessment[] = [
  { id: 'hist203-r1', courseId: 'hist203', title: 'Reading response — Confederation debates', kind: 'reading', due: daysFromNow(3), weight: 10, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'hist203-q1', courseId: 'hist203', title: 'Map quiz — Provinces & territories', kind: 'quiz', due: daysFromNow(8), weight: 10, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'hist203-mid', courseId: 'hist203', title: 'Midterm exam', kind: 'midterm', due: daysFromNow(16), weight: 25, provenance: { status: 'confirmed', confirmations: 7 }, status: 'not-started', grade: null, notes: '' },
  { id: 'hist203-src', courseId: 'hist203', title: 'Primary-source analysis', kind: 'assignment', due: daysFromNow(22), weight: 10, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'hist203-e1', courseId: 'hist203', title: 'Research essay — Post-war Canada', kind: 'project', due: daysFromNow(34), weight: 20, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
  { id: 'hist203-fin', courseId: 'hist203', title: 'Final exam', kind: 'final', due: daysFromNow(46), weight: 25, provenance: { status: 'official' }, status: 'not-started', grade: null, notes: '' },
]
