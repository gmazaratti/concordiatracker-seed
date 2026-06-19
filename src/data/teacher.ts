import type { Assessment, AssessmentKind, Course } from './types'
import type { Blueprint } from './blueprints'
import { CAMPUS_EVENTS, ORGS } from './community'
import type { CampusEvent, EventCategory, EventOrg } from './community'
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

/** The portal is one shell with two account roles — teachers manage course
 * outlines, organizers manage Community events. They share the auth context,
 * invite/approval mechanics, admin console, and layout. */
export type PortalRole = 'teacher' | 'organizer'

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
  /** Teacher or organizer access. */
  role: PortalRole
  name: string
  email: string
  /** Optional note (what they teach / their org) to help the admin. */
  message: string
  status: RequestStatus
  requestedDaysAgo: number
}

/** Next case-id number the provider counts up from (seeds use 1041–1043). */
export const FIRST_CASE_NUMBER = 1044
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

/** Works for any invite (teacher or org) — just the timing fields. */
type InviteTiming = { used: boolean; createdDaysAgo: number; expiresInDays: number }

export function inviteStatus(invite: InviteTiming | undefined): InviteStatus {
  if (!invite) return 'notfound'
  if (invite.used) return 'used'
  if (invite.createdDaysAgo > invite.expiresInDays) return 'expired'
  return 'valid'
}

export function expiresInLabel(invite: InviteTiming): string {
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
    caseId: 'REQ-1041', role: 'teacher', name: 'Dr. Liang Wu', email: 'liang.wu@concordia.ca',
    message: 'I teach COMP 352 — Data Structures & Algorithms.', status: 'pending', requestedDaysAgo: 2,
  },
  {
    caseId: 'REQ-1042', role: 'organizer', name: 'Concordia Robotics Society', email: 'robotics@concordia.ca',
    message: 'Student robotics club — we run builds, comps, and workshops.', status: 'pending', requestedDaysAgo: 3,
  },
  {
    caseId: 'REQ-1043', role: 'teacher', name: 'Prof. Renée Bélanger', email: 'renee.belanger@concordia.ca',
    message: 'POLI 311 instructor, hoping to publish my outline.', status: 'accepted', requestedDaysAgo: 6,
  },
]

/* =========================================================================
 * ORGANIZER role — student orgs/clubs that manage their Community events.
 * Same portal shell (invite + approval + admin + layout), different payload:
 * an editable org profile + a list of managed events with AGGREGATE-ONLY
 * mock metrics (never per-user). Real metrics are CONNECTION-PHASE.
 * ========================================================================= */
export interface EventMetrics {
  /** Aggregate counts ONLY — never which students. Intent (adds, follows) leads. */
  views: number
  follows: number
  calendarAdds: number
}

/** An event an organizer manages — the Community `CampusEvent` fields (minus the
 * org, which is the account's) plus private aggregate metrics. */
export interface ManagedEvent {
  id: string
  title: string
  start: string
  mode: 'in-person' | 'online'
  location: string
  category: EventCategory
  description: string
  image?: string
  relevantTo?: string[]
  postedDaysAgo: number
  metrics: EventMetrics
}

/** Who can manage an org's dashboard. Owners can't be removed; members are
 * invited by anyone already on the team (the access model below is a stub). */
export type OrgRole = 'owner' | 'admin' | 'member'

export interface OrgMember {
  id: string
  name: string
  email: string
  role: OrgRole
  /** `active` = accepted; `invited` = link sent, not yet accepted. */
  status: 'active' | 'invited'
  /** Days since they joined (for active members). */
  joinedDaysAgo: number
  /** The single-use link token while `invited`. */
  inviteToken?: string
  /** True for the current logged-in user — pinned + badged "You" in the team list. */
  isYou?: boolean
}

export interface OrgAccount {
  id: string
  email: string
  status: TeacherStatus
  /** The org profile the organizer edits — feeds the student org profile page. */
  org: EventOrg
  events: ManagedEvent[]
  /** Aggregate follower count (mock) — org-level, shown in totals + "notify". */
  followers: number
  /** People with access to this org's dashboard (team). */
  members: OrgMember[]
}

export interface OrgInvite {
  token: string
  recipientEmail: string
  orgName: string
  orgHandle: string
  glyph: string
  color: string
  createdDaysAgo: number
  expiresInDays: number
  used: boolean
}

/** A managed event → the student-facing `CampusEvent` (metrics dropped). */
export function eventToCommunity(m: ManagedEvent, org: EventOrg): CampusEvent {
  return {
    id: m.id,
    title: m.title,
    start: m.start,
    mode: m.mode,
    location: m.location,
    org,
    category: m.category,
    description: m.description,
    image: m.image,
    relevantTo: m.relevantTo,
    postedDaysAgo: m.postedDaysAgo,
  }
}

export function metricsTotals(events: ManagedEvent[]): EventMetrics {
  return events.reduce(
    (t, e) => ({
      views: t.views + e.metrics.views,
      follows: t.follows + e.metrics.follows,
      calendarAdds: t.calendarAdds + e.metrics.calendarAdds,
    }),
    { views: 0, follows: 0, calendarAdds: 0 },
  )
}

/** A blank event for the "create event" form (defaults to a week out). */
export function newManagedEvent(): ManagedEvent {
  return {
    id: uid('ev'),
    title: '',
    start: daysFromNow(7, 18, 0),
    mode: 'in-person',
    location: '',
    category: 'clubs',
    description: '',
    postedDaysAgo: 0,
    metrics: { views: 0, follows: 0, calendarAdds: 0 },
  }
}

/** A pending team-member invite (the org admin fills name + email + role). */
export function newOrgMemberInvite(input: { name: string; email: string; role: OrgRole }): OrgMember {
  return {
    id: uid('mem'),
    name: input.name,
    email: input.email,
    role: input.role,
    status: 'invited',
    joinedDaysAgo: 0,
    inviteToken: uid('join'),
  }
}

/** Scaffold an editable org profile from an invite (unverified until approved). */
export function orgFromInvite(invite: OrgInvite): EventOrg {
  return {
    name: invite.orgName,
    handle: invite.orgHandle,
    verified: false,
    glyph: invite.glyph,
    color: invite.color,
    bio: '',
  }
}

const orgIdentity = (handle: string): EventOrg => {
  const o = ORGS.find((x) => x.handle === handle)
  if (!o) throw new Error(`Unknown org ${handle}`)
  return { ...o }
}

// Seed an approved org's events from the existing Community data so there's no
// duplication — the merge then sources managed orgs from the provider.
const seededEvents = (handle: string, metricsById: Record<string, EventMetrics>): ManagedEvent[] =>
  CAMPUS_EVENTS.filter((e) => e.org.handle === handle).map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start,
    mode: e.mode,
    location: e.location,
    category: e.category,
    description: e.description,
    image: e.image,
    relevantTo: e.relevantTo,
    postedDaysAgo: e.postedDaysAgo,
    metrics: metricsById[e.id] ?? { views: 0, follows: 0, calendarAdds: 0 },
  }))

const HACK_METRICS: Record<string, EventMetrics> = {
  'ev-hackathon': { views: 1920, follows: 41, calendarAdds: 148 },
  'ev-hack-apis': { views: 642, follows: 12, calendarAdds: 53 },
  'ev-hack-past-conuhacks': { views: 5240, follows: 96, calendarAdds: 412 },
  'ev-hack-past-git': { views: 884, follows: 9, calendarAdds: 31 },
}

export const SEED_ORGS: OrgAccount[] = [
  {
    id: 'org-hack',
    email: 'team@hackconcordia.org',
    status: 'approved',
    org: { ...orgIdentity('@hackconcordia'), verified: true },
    events: seededEvents('@hackconcordia', HACK_METRICS),
    followers: 1240,
    members: [
      { id: 'm-hack-1', name: 'Priya Nair', email: 'team@hackconcordia.org', role: 'owner', status: 'active', joinedDaysAgo: 240 },
      { id: 'm-hack-2', name: 'Marc Tremblay', email: 'marc@hackconcordia.org', role: 'admin', status: 'active', joinedDaysAgo: 96 },
      { id: 'm-hack-3', name: 'Wei Chen', email: 'wei@hackconcordia.org', role: 'member', status: 'active', joinedDaysAgo: 28 },
    ],
  },
  {
    id: 'org-outdoors',
    email: 'outdoors@cua.concordia.ca',
    status: 'pending',
    org: { ...orgIdentity('@conu.outdoors') },
    events: seededEvents('@conu.outdoors', {}),
    followers: 318,
    members: [
      { id: 'm-out-1', name: 'Sophie Gagnon', email: 'outdoors@cua.concordia.ca', role: 'owner', status: 'active', joinedDaysAgo: 60 },
    ],
  },
]

export const SEED_ORG_INVITES: OrgInvite[] = [
  {
    token: 'demo-robotics',
    recipientEmail: 'robotics@concordia.ca',
    orgName: 'Concordia Robotics Society',
    orgHandle: '@conu.robotics',
    glyph: 'RS',
    color: '#5b9cf6',
    createdDaysAgo: 0,
    expiresInDays: 7,
    used: false,
  },
]
