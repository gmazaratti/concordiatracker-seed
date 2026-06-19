import type {
  Assessment,
  AssessmentKind,
  AssessmentStatus,
  CalendarTask,
  Course,
  Grade,
  ProvenanceStatus,
} from '@/data/types'
import type { Blueprint } from '@/data/blueprints'
import type { CampusEvent, EventCategory, EventOrg, OrgLinks } from '@/data/community'
import type { Announcement } from '@/data/announcements'
import type { ManagedEvent, OrgMember, OrgRole } from '@/data/teacher'

/**
 * The mapping layer between Supabase rows (the live schema) and the seed's richer
 * domain types. The DB stores grades as score/raw_score/raw_total + done/missed
 * booleans and assignment "type" strings; the app uses a single status enum, a
 * Grade object, a kind enum, and first-class provenance. Everything crosses here
 * so the rest of the app never sees a raw row. Phase 3.
 */

// ── Courses ─────────────────────────────────────────────────────────────────
export interface CourseRow {
  id: string
  code: string | null
  name: string | null
  location: string | null
  time: string | null
  professor: string | null
  prof_email: string | null
  ta_name: string | null
  ta_email: string | null
  color: string | null
  credits: number | null
  section: string | null
  office_hours: string | null
  syllabus_url: string | null
  term: string | null
  origin: string | null
}

export function courseFromRow(r: CourseRow): Course {
  return {
    id: r.id,
    code: r.code ?? '',
    title: r.name ?? '',
    term: r.term ?? '',
    credits: r.credits ?? 3,
    color: r.color ?? 'blue',
    section: r.section ?? '',
    instructor: { name: r.professor ?? '', email: r.prof_email ?? '' },
    ta: r.ta_name || r.ta_email ? { name: r.ta_name ?? '', email: r.ta_email ?? '' } : null,
    location: r.location ?? '',
    meetingTimes: r.time ?? '',
    officeHours: r.office_hours ?? undefined,
    syllabusUrl: r.syllabus_url ?? '',
    origin: r.origin === 'manual' ? 'manual' : undefined,
  }
}

/** Map a (partial) Course to DB columns — only the provided keys, so it works for
 * both inserts and patch updates. */
export function courseToRow(patch: Partial<Course>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('code' in patch) row.code = patch.code
  if ('title' in patch) row.name = patch.title
  if ('term' in patch) row.term = patch.term
  if ('credits' in patch) row.credits = patch.credits
  if ('color' in patch) row.color = patch.color
  if ('section' in patch) row.section = patch.section
  if (patch.instructor) {
    row.professor = patch.instructor.name
    row.prof_email = patch.instructor.email
  }
  if ('ta' in patch) {
    row.ta_name = patch.ta?.name ?? null
    row.ta_email = patch.ta?.email ?? null
  }
  if ('location' in patch) row.location = patch.location
  if ('meetingTimes' in patch) row.time = patch.meetingTimes
  if ('officeHours' in patch) row.office_hours = patch.officeHours ?? null
  if ('syllabusUrl' in patch) row.syllabus_url = patch.syllabusUrl
  if ('origin' in patch) row.origin = patch.origin
  return row
}

// ── Assessments ─────────────────────────────────────────────────────────────
export interface AssignmentRow {
  id: string
  course_id: string | null
  title: string | null
  date: string
  type: string | null
  weight: number | null
  score: number | null
  raw_score: number | null
  raw_total: number | null
  done: boolean | null
  missed: boolean | null
  awaiting_grade: boolean | null
  extension_granted: boolean | null
  notes: string | null
  status: string | null
  provenance_status: string | null
  provenance_confirmations: number | null
}

const SEED_KINDS = new Set<string>(['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project'])
// Fallback for legacy/production `type` strings that aren't already a seed kind.
const TYPE_TO_KIND: Record<string, AssessmentKind> = {
  Exam: 'final', Midterm: 'midterm', Final: 'final', Quiz: 'quiz', Homework: 'assignment',
  Assignment: 'assignment', Project: 'project', Lab: 'lab', Reading: 'reading',
}

export function kindFromType(type: string | null): AssessmentKind {
  const t = (type ?? '').trim()
  if (SEED_KINDS.has(t.toLowerCase())) return t.toLowerCase() as AssessmentKind
  return TYPE_TO_KIND[t] ?? 'assignment'
}

function gradeFromRow(r: AssignmentRow): Grade | null {
  if (r.raw_score != null && r.raw_total != null) {
    return { mode: 'raw', percent: null, earned: r.raw_score, total: r.raw_total }
  }
  if (r.score != null) return { mode: 'percent', percent: r.score, earned: null, total: null }
  return null
}

function gradeToCols(grade: Grade | null) {
  if (!grade) return { score: null, raw_score: null, raw_total: null }
  if (grade.mode === 'raw') return { score: null, raw_score: grade.earned, raw_total: grade.total }
  return { score: grade.percent, raw_score: null, raw_total: null }
}

/** Keep the legacy booleans in sync with the seed's status enum, so the data is
 * consistent both ways (and the old columns never go stale). */
function statusToCols(status: AssessmentStatus) {
  return {
    status,
    done: status === 'done',
    missed: status === 'missed',
    awaiting_grade: status === 'awaiting-grade',
    extension_granted: status === 'extension',
  }
}

function statusFromRow(r: AssignmentRow): AssessmentStatus {
  if (r.status) return r.status as AssessmentStatus
  if (r.done) return 'done'
  if (r.missed) return 'missed'
  if (r.awaiting_grade) return 'awaiting-grade'
  if (r.extension_granted) return 'extension'
  return 'not-started'
}

export function assessmentFromRow(r: AssignmentRow): Assessment {
  return {
    id: r.id,
    courseId: r.course_id ?? '',
    title: r.title ?? '',
    kind: kindFromType(r.type),
    due: r.date,
    weight: r.weight ?? 0,
    provenance: {
      status: (r.provenance_status as ProvenanceStatus) ?? 'unverified',
      confirmations: r.provenance_confirmations || undefined,
    },
    status: statusFromRow(r),
    grade: gradeFromRow(r),
    notes: r.notes ?? '',
  }
}

/** A full Assessment → an insert row (no `id`/`user_id` here — the caller adds
 * user_id and the DB generates the uuid id). */
export function assessmentToInsert(a: Assessment, userId: string): Record<string, unknown> {
  return {
    user_id: userId,
    course_id: a.courseId || null,
    title: a.title,
    date: a.due,
    type: a.kind,
    weight: a.weight,
    notes: a.notes,
    provenance_status: a.provenance.status,
    provenance_confirmations: a.provenance.confirmations ?? 0,
    ...statusToCols(a.status),
    ...gradeToCols(a.grade),
  }
}

/** A partial Assessment patch → DB columns (the edit modal / inline edits). */
export function assessmentPatchToRow(patch: Partial<Assessment>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('courseId' in patch) row.course_id = patch.courseId || null
  if ('title' in patch) row.title = patch.title
  if (patch.kind) row.type = patch.kind
  if ('due' in patch) row.date = patch.due
  if ('weight' in patch) row.weight = patch.weight
  if ('notes' in patch) row.notes = patch.notes
  if (patch.provenance) {
    row.provenance_status = patch.provenance.status
    row.provenance_confirmations = patch.provenance.confirmations ?? 0
  }
  if (patch.status) Object.assign(row, statusToCols(patch.status))
  if ('grade' in patch) Object.assign(row, gradeToCols(patch.grade ?? null))
  return row
}

// ── Personal calendar tasks (todos) ─────────────────────────────────────────
export interface TodoRow {
  id: string
  title: string | null
  due: string | null
  note: string | null
  done: boolean | null
}

export function taskFromRow(r: TodoRow): CalendarTask {
  return {
    id: r.id,
    title: r.title ?? '',
    due: r.due ?? '',
    done: !!r.done,
    note: r.note ?? undefined,
  }
}

export function taskToInsert(
  task: { title: string; due: string; note?: string },
  userId: string,
): Record<string, unknown> {
  return { user_id: userId, title: task.title, due: task.due, note: task.note ?? null, done: false }
}

// ── Blueprints (shared_blueprints) ──────────────────────────────────────────
/** One item in a blueprint's `items` jsonb array (the DB shape). `name` is the
 * legacy production key for the title — accepted so raw prod exports still work. */
interface BlueprintItem {
  title?: string
  name?: string
  kind?: string
  weight?: number
  due?: string
}

export interface BlueprintRow {
  id: string
  user_id: string | null
  course_code: string | null
  course_name: string | null
  professor: string | null
  author: string | null
  section: string | null
  term: string | null
  items: BlueprintItem[] | null
  verified: boolean | null
  upvotes: number | null
  downvotes: number | null
  imports: number | null
  created_at: string
}

const DAY_MS = 86_400_000

/** Course codes vary in spacing/case ("comp 248", "COMP248") — normalize to one
 * canonical form ("COMP 248") so a student's course matches shared blueprints. */
export function normalizeCode(code: string): string {
  const t = code.trim().toUpperCase().replace(/\s+/g, ' ')
  // Split a run-together "COMP248" into "COMP 248" (letters then digits).
  const m = t.match(/^([A-Z]+)\s*(\d.*)$/)
  return m ? `${m[1]} ${m[2]}` : t
}

export function blueprintFromRow(r: BlueprintRow): Blueprint {
  const verified = !!r.verified
  const items = Array.isArray(r.items) ? r.items : []
  const uploadedDaysAgo = Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / DAY_MS))
  return {
    id: r.id,
    // Used as a grouping label only — the real course id is stamped at import.
    courseId: normalizeCode(r.course_code ?? ''),
    section: r.section ?? '',
    instructor: r.professor ?? '',
    term: r.term ?? '',
    teacherVerified: verified,
    author: r.author || r.professor || 'Anonymous',
    upvotes: r.upvotes ?? 0,
    downvotes: r.downvotes ?? 0,
    imports: r.imports ?? 0,
    uploadedDaysAgo,
    dates: items.map((it) => ({
      title: it.title ?? it.name ?? '',
      kind: kindFromType(it.kind ?? null),
      weight: it.weight ?? 0,
      due: it.due ?? new Date().toISOString(),
      // No ground truth for community uploads → unverified; teacher rows → official.
      provenance: { status: (verified ? 'official' : 'unverified') as ProvenanceStatus },
    })),
  }
}

/** Build the `items` jsonb for a contributed blueprint from a course's real
 * assessments (the student is sharing their own outline). */
export function assessmentsToBlueprintItems(assessments: Assessment[]): BlueprintItem[] {
  return assessments.map((a) => ({ title: a.title, kind: a.kind, weight: a.weight, due: a.due }))
}

/** A student-contributed blueprint → an insert row for `shared_blueprints`. */
export function blueprintToInsert(args: {
  userId: string
  course: Course
  author: string
  assessments: Assessment[]
}): Record<string, unknown> {
  return {
    user_id: args.userId,
    course_code: normalizeCode(args.course.code),
    course_name: args.course.title,
    professor: args.course.instructor.name,
    author: args.author,
    section: args.course.section,
    term: args.course.term,
    verified: false,
    upvotes: 0,
    downvotes: 0,
    imports: 0,
    items: assessmentsToBlueprintItems(args.assessments),
  }
}

// ── Community: organizations + events ────────────────────────────────────────
export interface OrgRow {
  id: string
  handle: string
  name: string | null
  verified: boolean | null
  glyph: string | null
  color: string | null
  logo: string | null
  banner: string | null
  bio: string | null
  links: OrgLinks | null
}

export function orgFromRow(r: OrgRow): EventOrg {
  return {
    name: r.name ?? '',
    handle: r.handle,
    verified: !!r.verified,
    glyph: r.glyph ?? '',
    color: r.color ?? '#888888',
    logo: r.logo ?? undefined,
    banner: r.banner ?? undefined,
    bio: r.bio ?? '',
    links: r.links && Object.keys(r.links).length ? r.links : undefined,
  }
}

export interface EventRow {
  id: string
  org_id: string
  title: string | null
  start: string
  mode: string | null
  location: string | null
  category: string | null
  description: string | null
  image: string | null
  relevant_to: string[] | null
  posted_at: string
}

// ── Announcements ────────────────────────────────────────────────────────────
export interface AnnouncementRow {
  id: string
  course_code: string
  title: string | null
  body: string | null
  posted_at: string
  edited_at: string | null
}

const daysAgo = (iso: string) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / DAY_MS))

export function announcementFromRow(r: AnnouncementRow): Announcement {
  return {
    id: r.id,
    courseCode: normalizeCode(r.course_code),
    title: r.title ?? '',
    body: r.body ?? '',
    postedDaysAgo: daysAgo(r.posted_at),
    editedDaysAgo: r.edited_at ? daysAgo(r.edited_at) : undefined,
  }
}

/** An event row + its (already-mapped) host org → a CampusEvent. */
export function eventFromRow(r: EventRow, org: EventOrg): CampusEvent {
  return {
    id: r.id,
    title: r.title ?? '',
    start: r.start,
    mode: r.mode === 'online' ? 'online' : 'in-person',
    location: r.location ?? '',
    org,
    category: (r.category as EventCategory) ?? 'clubs',
    description: r.description ?? '',
    image: r.image ?? undefined,
    relevantTo: r.relevant_to && r.relevant_to.length ? r.relevant_to : undefined,
    postedDaysAgo: Math.max(0, Math.round((Date.now() - new Date(r.posted_at).getTime()) / DAY_MS)),
  }
}

/** An event row → a ManagedEvent (the organizer's own view). Metrics are
 * aggregate-only / connection-phase, so they read 0 here. */
export function eventRowToManaged(r: EventRow): ManagedEvent {
  return {
    id: r.id,
    title: r.title ?? '',
    start: r.start,
    mode: r.mode === 'online' ? 'online' : 'in-person',
    location: r.location ?? '',
    category: (r.category as EventCategory) ?? 'clubs',
    description: r.description ?? '',
    image: r.image ?? undefined,
    relevantTo: r.relevant_to && r.relevant_to.length ? r.relevant_to : undefined,
    postedDaysAgo: Math.max(0, Math.round((Date.now() - new Date(r.posted_at).getTime()) / DAY_MS)),
    metrics: { views: 0, follows: 0, calendarAdds: 0 },
  }
}

/** A `org_members` row → the OrgMember domain shape. */
export interface OrgMemberRow {
  id: string
  name: string | null
  email: string | null
  role: string
  status: string
  invite_token: string | null
  joined_at: string | null
}
export function orgMemberFromRow(r: OrgMemberRow): OrgMember {
  return {
    id: r.id,
    name: r.name ?? '',
    email: r.email ?? '',
    role: (['owner', 'admin', 'member'].includes(r.role) ? r.role : 'member') as OrgRole,
    status: r.status === 'active' ? 'active' : 'invited',
    joinedDaysAgo: r.joined_at
      ? Math.max(0, Math.round((Date.now() - new Date(r.joined_at).getTime()) / DAY_MS))
      : 0,
    inviteToken: r.invite_token ?? undefined,
  }
}

/** A (partial) ManagedEvent → `events` columns (insert or patch). */
export function managedEventToRow(patch: Partial<ManagedEvent>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('title' in patch) row.title = patch.title
  if ('start' in patch) row.start = patch.start
  if ('mode' in patch) row.mode = patch.mode
  if ('location' in patch) row.location = patch.location
  if ('category' in patch) row.category = patch.category
  if ('description' in patch) row.description = patch.description
  if ('image' in patch) row.image = patch.image ?? null
  if ('relevantTo' in patch) row.relevant_to = patch.relevantTo ?? []
  return row
}

/** A (partial) EventOrg profile → `organizations` columns. */
export function orgProfileToRow(patch: Partial<EventOrg>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if ('name' in patch) row.name = patch.name
  if ('handle' in patch) row.handle = patch.handle
  if ('verified' in patch) row.verified = patch.verified
  if ('glyph' in patch) row.glyph = patch.glyph
  if ('color' in patch) row.color = patch.color
  if ('logo' in patch) row.logo = patch.logo ?? null
  if ('banner' in patch) row.banner = patch.banner ?? null
  if ('bio' in patch) row.bio = patch.bio
  if ('links' in patch) row.links = patch.links ?? {}
  return row
}
