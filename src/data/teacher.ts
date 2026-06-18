import type { Assessment, AssessmentKind, Course } from './types'
import type { Blueprint } from './blueprints'
import { term } from './mock'
import { daysFromNow } from '@/lib/date'

/**
 * Teacher-portal mock data — the THIRD context (student / teacher / public).
 *
 * ACCESS MODEL (invite-based, two gates): an admin originates an INVITE
 * (pre-scaffolds name + course/section); the teacher accepts it (single-use,
 * expiring, email-bound), which creates a PENDING account; an admin then APPROVES
 * before the teacher can publish.
 *
 * STUB / CONNECTION-PHASE: invite-email delivery, the email-confirmation step,
 * approval, and verification all need a real backend — the seed builds only the
 * UX shape, in-memory, behind `useTeacher` (swap to Supabase later).
 */
export type TeacherStatus = 'pending' | 'approved'

export interface OutlineItem {
  id: string
  kind: AssessmentKind
  title: string
  /** ISO due timestamp (runtime-relative, like the rest of the seed). */
  due: string
  weight: number
}

/** A course a teacher manages — its outline + whether it's been published as the
 * teacher-verified blueprint. `stats` carries adoption for already-established
 * (seeded) courses; a fresh publish starts at zero. */
export interface TeacherCourse {
  courseId: string
  code: string
  title: string
  section: string
  outline: OutlineItem[]
  published: boolean
  stats?: { upvotes: number; downvotes: number; imports: number; uploadedDaysAgo: number }
}

export interface TeacherAccount {
  id: string
  name: string
  email: string
  status: TeacherStatus
  courses: TeacherCourse[]
}

export interface TeacherInvite {
  token: string
  recipientEmail: string
  teacherName: string
  courseId: string
  code: string
  title: string
  section: string
  createdDaysAgo: number
  expiresInDays: number
  used: boolean
}

export type InviteStatus = 'valid' | 'expired' | 'used' | 'notfound'

/** A self-serve access request from a prospective teacher (before any invite).
 * The admin accepts/denies; the requester checks back by Case ID. */
export type RequestStatus = 'pending' | 'accepted' | 'denied'

export interface AccessRequest {
  /** Human-friendly sortable ticket, e.g. "REQ-1043". */
  caseId: string
  name: string
  email: string
  /** Optional note (what they teach) to help the admin. */
  message: string
  status: RequestStatus
  requestedDaysAgo: number
}

/** Next case-id number the provider counts up from (seeds use the ones below). */
export const FIRST_CASE_NUMBER = 1043
export const caseIdFor = (n: number) => `REQ-${n}`

let seq = 0
/** Runtime id/token generator (app runtime — not the workflow sandbox). */
export function uid(prefix: string): string {
  seq += 1
  return `${prefix}-${seq}-${Math.random().toString(36).slice(2, 8)}`
}

function mkOutline(prefix: string, rows: Omit<OutlineItem, 'id'>[]): OutlineItem[] {
  return rows.map((r, i) => ({ id: `${prefix}-${i + 1}`, ...r }))
}

export function outlineWeight(items: OutlineItem[]): number {
  return items.reduce((sum, i) => sum + (Number.isFinite(i.weight) ? i.weight : 0), 0)
}

export function inviteStatus(invite: TeacherInvite | undefined): InviteStatus {
  if (!invite) return 'notfound'
  if (invite.used) return 'used'
  if (invite.createdDaysAgo > invite.expiresInDays) return 'expired'
  return 'valid'
}

export function expiresInLabel(invite: TeacherInvite): string {
  const left = invite.expiresInDays - invite.createdDaysAgo
  if (left <= 0) return 'Expired'
  if (left === 1) return 'Expires tomorrow'
  return `Expires in ${left} days`
}

/** Mask an email for the (stubbed) confirmation step, e.g. h••••@concordia.ca. */
export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  if (!domain) return email
  return `${user[0]}••••@${domain}`
}

/** Materialize a teacher's course outline into the TEACHER-VERIFIED blueprint the
 * student browser pins — the supply pipe. Dates land as `official`. */
export function outlineToBlueprint(tc: TeacherCourse, teacherName: string): Blueprint {
  const s = tc.stats ?? { upvotes: 0, downvotes: 0, imports: 0, uploadedDaysAgo: 0 }
  return {
    id: `tc-${tc.courseId}-${tc.section}`,
    courseId: tc.courseId,
    section: tc.section,
    instructor: teacherName,
    term: term.name,
    teacherVerified: true,
    author: teacherName,
    upvotes: s.upvotes,
    downvotes: s.downvotes,
    imports: s.imports,
    uploadedDaysAgo: s.uploadedDaysAgo,
    dates: tc.outline.map((o) => ({
      title: o.title,
      kind: o.kind,
      weight: o.weight,
      due: o.due,
      provenance: { status: 'official' as const },
    })),
  }
}

/** Synthesize a Course for a teacher course not in the student catalog (a created
 * one). Linked catalog courses should use the real Course instead. */
export function teacherCourseToCourse(tc: TeacherCourse): Course {
  return {
    id: tc.courseId,
    code: tc.code,
    title: tc.title,
    term: term.name,
    credits: 3,
    color: 'blue',
    section: tc.section,
    instructor: { name: '', email: '' },
    ta: null,
    location: '',
    meetingTimes: '',
    syllabusUrl: '',
  }
}

/** One outline row → a student Assessment (Official, ungraded) — for the parse
 * round-trip and the student preview. */
export function outlineItemToAssessment(o: OutlineItem, courseId: string): Assessment {
  return {
    id: o.id,
    courseId,
    title: o.title,
    kind: o.kind,
    due: o.due,
    weight: o.weight,
    provenance: { status: 'official' },
    status: 'not-started',
    grade: null,
    notes: '',
  }
}

/** The set of dates a "parse" lifts out of a sample syllabus (the teacher's parse
 * path reuses the student parse-reveal). Generic + sums to 100. */
export function sampleParsedOutline(): OutlineItem[] {
  return mkOutline('parsed', [
    { kind: 'quiz', title: 'Quiz 1', weight: 10, due: daysFromNow(7, 23, 59) },
    { kind: 'assignment', title: 'Assignment 1', weight: 15, due: daysFromNow(14, 23, 59) },
    { kind: 'midterm', title: 'Midterm exam', weight: 25, due: daysFromNow(21, 14, 0) },
    { kind: 'assignment', title: 'Assignment 2', weight: 15, due: daysFromNow(35, 23, 59) },
    { kind: 'final', title: 'Final exam', weight: 35, due: daysFromNow(49, 9, 0) },
  ])
}

export const SEED_TEACHERS: TeacherAccount[] = [
  {
    id: 't-hanna', name: 'Dr. Aiman Hanna', email: 'aiman.hanna@concordia.ca', status: 'approved',
    courses: [
      {
        courseId: 'comp248', code: 'COMP 248', title: 'Object-Oriented Programming I', section: 'BB',
        published: true, stats: { upvotes: 64, downvotes: 1, imports: 412, uploadedDaysAgo: 38 },
        outline: mkOutline('c248', [
          { kind: 'lab', title: 'Lab 1 — Environment setup', weight: 5, due: daysFromNow(-18, 23, 59) },
          { kind: 'assignment', title: 'Assignment 1 — Methods & arrays', weight: 10, due: daysFromNow(-8, 23, 59) },
          { kind: 'assignment', title: 'Assignment 2 — Inheritance', weight: 10, due: daysFromNow(2, 23, 59) },
          { kind: 'midterm', title: 'Midterm exam', weight: 25, due: daysFromNow(9, 14, 0) },
          { kind: 'project', title: 'Final project — Console app', weight: 20, due: daysFromNow(28, 23, 59) },
          { kind: 'final', title: 'Final exam', weight: 30, due: daysFromNow(40, 9, 0) },
        ]),
      },
    ],
  },
  {
    id: 't-salee', name: 'Dr. Daniel Salée', email: 'daniel.salee@concordia.ca', status: 'approved',
    courses: [
      {
        courseId: 'poli202', code: 'POLI 202', title: 'Introduction to Political Science', section: 'D',
        published: true, stats: { upvotes: 47, downvotes: 0, imports: 263, uploadedDaysAgo: 33 },
        outline: mkOutline('poli', [
          { kind: 'assignment', title: 'Response paper 1 — Social contract', weight: 10, due: daysFromNow(-9, 23, 59) },
          { kind: 'assignment', title: 'Discussion post — Federalism', weight: 5, due: daysFromNow(-1, 23, 59) },
          { kind: 'quiz', title: 'Reading quiz — Comparative systems', weight: 5, due: daysFromNow(6, 14, 0) },
          { kind: 'midterm', title: 'Midterm exam', weight: 30, due: daysFromNow(14, 18, 0) },
          { kind: 'final', title: 'Final exam', weight: 50, due: daysFromNow(32, 9, 0) },
        ]),
      },
    ],
  },
  {
    id: 't-dafni', name: 'Dr. Galia Dafni', email: 'galia.dafni@concordia.ca', status: 'pending',
    courses: [
      {
        courseId: 'math205', code: 'MATH 205', title: 'Differential & Integral Calculus II', section: 'C',
        published: false,
        outline: mkOutline('math', [
          { kind: 'quiz', title: 'Quiz 1 — Integration techniques', weight: 8, due: daysFromNow(-15, 23, 59) },
          { kind: 'midterm', title: 'Midterm exam', weight: 30, due: daysFromNow(3, 14, 0) },
        ]),
      },
    ],
  },
]

export const SEED_INVITES: TeacherInvite[] = [
  {
    token: 'demo-comm217', recipientEmail: 'helene.tremblay@concordia.ca', teacherName: 'Dr. Hélène Tremblay',
    courseId: 'comm217', code: 'COMM 217', title: 'Financial Accounting', section: 'AA',
    createdDaysAgo: 0, expiresInDays: 7, used: false,
  },
  {
    token: 'demo-expired', recipientEmail: 'pat.lee@concordia.ca', teacherName: 'Dr. Pat Lee',
    courseId: 'engl233', code: 'ENGL 233', title: 'Introduction to Fiction', section: 'AA',
    createdDaysAgo: 12, expiresInDays: 7, used: false,
  },
]

export const SEED_REQUESTS: AccessRequest[] = [
  {
    caseId: 'REQ-1041', name: 'Dr. Liang Wu', email: 'liang.wu@concordia.ca',
    message: 'I teach COMP 352 — Data Structures & Algorithms.', status: 'pending', requestedDaysAgo: 2,
  },
  {
    caseId: 'REQ-1042', name: 'Prof. Renée Bélanger', email: 'renee.belanger@concordia.ca',
    message: 'POLI 311 instructor, hoping to publish my outline.', status: 'accepted', requestedDaysAgo: 6,
  },
]
