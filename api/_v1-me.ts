/**
 * /api/v1/me/* — one student's own data, read side.
 *
 * SCOPE IS THE WHOLE SECURITY MODEL HERE. Every query in this file and in
 * _v1-me-write.ts filters on `user_id = caller.userId`, and the caller id
 * comes from the TOKEN ROW, never from the request. There is no path,
 * parameter or body field that can point at somebody else's data: a leaked
 * personal token is bad for one person and cannot become bad for anyone else.
 *
 * WHY THE SERVICE ROLE RATHER THAN RLS. An API token is not a Supabase
 * session, so there is no JWT to hand PostgREST and RLS has no `auth.uid()`
 * to work from. The filter is therefore ours to apply, and it is applied in
 * ONE place — `mine()` — rather than remembered at each call site.
 */
import { svc, iso } from './_v1-auth.js'
import { currentGpa, gpaLines, coursePercent, courseStanding } from '../src/lib/gpa.js'
import type { Assessment, Course as DomainCourse } from '../src/data/types.js'

interface Json {
  [k: string]: unknown
}

/**
 * A PostgREST request as the service role, always scoped to one user.
 *
 * `noFilter` exists only for INSERTs, where the owner is in the body rather
 * than the query string. Everything that reads or changes an existing row
 * goes through the filter, and that is not optional.
 */
export async function mine<T>(
  userId: string,
  path: string,
  init?: {
    method?: string
    body?: unknown
    prefer?: string
    noFilter?: boolean
  },
): Promise<T[] | null> {
  const s = svc()
  if (!s) return null
  const joiner = path.includes('?') ? '&' : '?'
  const url = init?.noFilter
    ? `${s.url}/rest/v1/${path}`
    : `${s.url}/rest/v1/${path}${joiner}user_id=eq.${userId}`
  const res = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: {
      apikey: s.key,
      Authorization: `Bearer ${s.key}`,
      'Content-Type': 'application/json',
      ...(init?.prefer ? { Prefer: init.prefer } : {}),
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  })
  if (!res.ok) return null
  return ((await res.json().catch(() => [])) as T[]) ?? []
}

export interface CourseRow {
  id: string
  code: string | null
  name: string | null
  term: string | null
  credits: number | null
  color: string | null
  section: string | null
  professor: string | null
  prof_email: string | null
  location: string | null
  time: string | null
  office_hours: string | null
  syllabus_url: string | null
  grading_scale: string | null
  enrollment: string | null
  archived: boolean | null
  final_percent: number | null
  final_letter: string | null
}

export interface AssignRow {
  id: string
  course_id: string | null
  title: string | null
  date: string | null
  type: string | null
  weight: number | null
  score: number | null
  raw_score: number | null
  raw_total: number | null
  status: string | null
  done: boolean | null
  missed: boolean | null
  awaiting_grade: boolean | null
  extension_granted: boolean | null
  notes: string | null
  description: string | null
  provenance_status: string | null
  provenance_confirmations: number | null
  deleted: boolean | null
}

/** The same precedence the app uses, so the API cannot report a different
 *  status than the screen does for the same row. */
export function statusOf(r: AssignRow): string {
  if (r.status) return r.status
  if (r.done) return 'done'
  if (r.missed) return 'missed'
  if (r.awaiting_grade) return 'awaiting-grade'
  if (r.extension_granted) return 'extension'
  return 'not-started'
}

export interface GradeView {
  mode: 'raw' | 'percent'
  percent: number | null
  earned: number | null
  total: number | null
}

export function gradeOf(r: AssignRow): GradeView | null {
  if (r.raw_score != null && r.raw_total != null) {
    return {
      mode: 'raw',
      earned: r.raw_score,
      total: r.raw_total,
      percent: r.raw_total ? Math.round((r.raw_score / r.raw_total) * 1000) / 10 : null,
    }
  }
  if (r.score != null) return { mode: 'percent', percent: r.score, earned: null, total: null }
  return null
}

export const course = (c: CourseRow): Json => ({
  id: c.id,
  code: c.code ?? '',
  name: c.name ?? '',
  title: c.name ?? '',
  semester: c.term ?? '',
  term: c.term ?? '',
  credits: c.credits ?? 3,
  color: c.color ?? 'blue',
  section: c.section ?? '',
  instructor: c.professor ?? '',
  instructor_email: c.prof_email ?? '',
  location: c.location ?? '',
  meeting_times: c.time ?? '',
  office_hours: c.office_hours ?? '',
  syllabus_url: c.syllabus_url ?? '',
  grading_scale: c.grading_scale ?? '',
  enrollment: c.enrollment ?? 'registered',
  archived: !!c.archived,
  final_grade: c.final_letter ?? null,
  final_percent: c.final_percent ?? null,
})

export const assignment = (a: AssignRow): Json => ({
  id: a.id,
  course_id: a.course_id,
  title: a.title ?? '',
  kind: a.type ?? 'assignment',
  due_at: a.date ? iso(a.date) : null,
  due: a.date ? iso(a.date) : null,
  weight: a.weight ?? 0,
  status: statusOf(a),
  done: statusOf(a) === 'done',
  grade: gradeOf(a),
  notes: a.notes ?? '',
  description: a.description ?? '',
  provenance: {
    status: a.provenance_status ?? 'unverified',
    confirmations: a.provenance_confirmations ?? null,
  },
})

/**
 * Rows the app would show.
 *
 * `deleted = false` IS NOT OPTIONAL. The web app loads with that filter and
 * hard-deletes nothing through this API, so leaving it off meant the token
 * returned assignments the website hides — and, worse, counted them in the
 * GPA. Found by reading the app's own query rather than by anything failing.
 */
const LIVE = 'deleted=eq.false'

const liveAssignments = (userId: string, extra = '') =>
  mine<AssignRow>(userId, `assignments?select=*&${LIVE}${extra}`)

/* ── Reads ───────────────────────────────────────────────────────────────── */

export async function meCourses(userId: string, q: Json): Promise<{ status: number; json: Json }> {
  const rows = (await mine<CourseRow>(userId, 'courses?select=*')) ?? []
  const wantArchived = String(q.archived ?? '') === 'true'
  const shown = rows.filter((r) => !!r.archived === wantArchived)
  return {
    status: 200,
    json: {
      generated_at: iso(Date.now()),
      timezone: 'UTC',
      count: shown.length,
      courses: shown.map(course),
    },
  }
}

export async function meAssignments(
  userId: string,
  q: Json,
): Promise<{ status: number; json: Json }> {
  const rows = (await liveAssignments(userId, '&order=date.asc')) ?? []

  const courseId = String(q.course_id ?? '').trim()
  const statusWanted = String(q.status ?? '').trim()
  const needle = String(q.q ?? '').trim().toLowerCase()

  let shown = rows
  if (courseId) shown = shown.filter((r) => r.course_id === courseId)

  // `todo` and `done` are the two a caller actually asks for; the six real
  // statuses are still accepted by name. `all` is the same as omitting it.
  if (statusWanted && statusWanted !== 'all') {
    if (statusWanted === 'todo') shown = shown.filter((r) => statusOf(r) !== 'done')
    else if (statusWanted === 'done') shown = shown.filter((r) => statusOf(r) === 'done')
    else shown = shown.filter((r) => statusOf(r) === statusWanted)
  }

  // Title OR description, so "find the linked lists one" works when the
  // phrase is in the blurb rather than the name.
  if (needle) {
    shown = shown.filter(
      (r) =>
        (r.title ?? '').toLowerCase().includes(needle) ||
        (r.description ?? '').toLowerCase().includes(needle),
    )
  }

  const before = String(q.due_before ?? '').trim()
  const after = String(q.due_after ?? '').trim()
  for (const [raw, keep] of [
    [before, (t: number, at: number) => t <= at],
    [after, (t: number, at: number) => t >= at],
  ] as const) {
    if (!raw) continue
    // `now` is spelled out because it is the obvious thing to pass and a
    // silent NaN would drop every row without saying why.
    const at = raw.toLowerCase() === 'now' ? Date.now() : Date.parse(raw)
    if (Number.isNaN(at)) {
      return {
        status: 400,
        json: { error: 'due_before / due_after must be an ISO-8601 timestamp, or "now".' },
      }
    }
    // An UNDATED assignment is excluded from a date filter rather than
    // treated as due at the epoch: we do not know when it is.
    shown = shown.filter((r) => !!r.date && keep(Date.parse(r.date), at))
  }

  const perPage = Math.max(1, Math.min(Number(q.per_page) || 100, 500))
  const page = Math.max(1, Number(q.page) || 1)
  const total = shown.length
  const slice = shown.slice((page - 1) * perPage, page * perPage)

  return {
    status: 200,
    json: {
      generated_at: iso(Date.now()),
      timezone: 'UTC',
      count: slice.length,
      total,
      page,
      per_page: perPage,
      assignments: slice.map(assignment),
    },
  }
}

const STATUSES = new Set([
  'not-started',
  'in-progress',
  'done',
  'late',
  'missed',
  'extension',
  'awaiting-grade',
])

/** Build the patch for one assignment, or say what is wrong with it. */
function assignmentPatch(body: Json): { patch: Json } | { error: string } {
  const patch: Json = {}

  if ('status' in body || 'done' in body) {
    // `done: true` is how a caller naturally says it; both map to the same
    // six-state model the app uses, so the screen and the API agree.
    const s =
      'status' in body ? String(body.status ?? '') : body.done ? 'done' : 'not-started'
    if (!STATUSES.has(s)) return { error: `Unknown status. One of: ${[...STATUSES].join(', ')}.` }
    patch.status = s
    patch.done = s === 'done'
    patch.missed = s === 'missed'
    patch.awaiting_grade = s === 'awaiting-grade'
    patch.extension_granted = s === 'extension'
  }

  if ('title' in body) {
    const t = String(body.title ?? '').trim()
    if (!t) return { error: 'A title cannot be empty.' }
    patch.title = t
  }
  if ('notes' in body) patch.notes = String(body.notes ?? '').slice(0, 5000)
  if ('description' in body) patch.description = String(body.description ?? '').slice(0, 5000)
  if ('weight' in body) {
    const w = Number(body.weight)
    if (!Number.isFinite(w) || w < 0 || w > 100) return { error: 'weight must be between 0 and 100.' }
    patch.weight = w
  }
  if ('course_id' in body) patch.course_id = body.course_id ? String(body.course_id) : null

  if ('due_at' in body || 'due' in body) {
    const raw = 'due_at' in body ? body.due_at : body.due
    if (raw == null) patch.date = null
    else if (Number.isNaN(Date.parse(String(raw)))) {
      return { error: 'due_at must be an ISO-8601 timestamp, or null to clear it.' }
    } else patch.date = new Date(String(raw)).toISOString()
  }

  if ('grade' in body) {
    const g = body.grade as Json | null
    if (g === null) {
      patch.score = null
      patch.raw_score = null
      patch.raw_total = null
    } else if (g && typeof g === 'object') {
      const percent = g.percent == null ? null : Number(g.percent)
      const earned = g.earned == null ? null : Number(g.earned)
      const total = g.total == null ? null : Number(g.total)
      if (earned != null && total != null) {
        if (!(total > 0) || earned < 0) return { error: 'A raw grade needs earned >= 0 and total > 0.' }
        patch.raw_score = earned
        patch.raw_total = total
        patch.score = null
      } else if (percent != null) {
        if (!Number.isFinite(percent) || percent < 0 || percent > 1000) {
          return { error: 'A percentage grade must be between 0 and 1000.' }
        }
        patch.score = percent
        patch.raw_score = null
        patch.raw_total = null
      } else {
        return { error: 'Give `grade` as {percent} or {earned,total}, or null to clear it.' }
      }
    }
  }

  return { patch }
}

export async function patchAssignment(
  userId: string,
  id: string,
  body: Json,
): Promise<{ status: number; json: Json }> {
  if (!id) return { status: 400, json: { error: 'Which assignment? Give an id in the path.' } }

  const built = assignmentPatch(body)
  if ('error' in built) return { status: 400, json: { error: built.error } }
  if (!Object.keys(built.patch).length) {
    return { status: 400, json: { error: 'Nothing to change.' } }
  }

  const rows = await mine<AssignRow>(userId, `assignments?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: built.patch,
    prefer: 'return=representation',
  })
  if (rows === null) return { status: 502, json: { error: 'The database refused the update.' } }
  if (!rows.length) {
    // The filter includes user_id, so "no rows" means it is not theirs OR it
    // does not exist — deliberately the same answer.
    return { status: 404, json: { error: 'No assignment with that id on your account.' } }
  }
  return { status: 200, json: { updated: assignment(rows[0]) } }
}

/** Set or clear just the grade, for callers that want the narrow verb. */
export async function setGrade(
  userId: string,
  id: string,
  body: Json,
): Promise<{ status: number; json: Json }> {
  const grade = 'grade' in body ? body.grade : body
  return patchAssignment(userId, id, { grade })
}

/* ── GPA and calendar ────────────────────────────────────────────────────── */

/** A row as the shared library expects it. Only the fields the maths reads. */
function toDomainAssessment(a: AssignRow): Assessment {
  const g = gradeOf(a)
  return {
    id: a.id,
    courseId: a.course_id ?? '',
    title: a.title ?? '',
    kind: (a.type ?? 'assignment') as Assessment['kind'],
    due: a.date,
    weight: a.weight ?? 0,
    provenance: { status: 'unverified' },
    status: statusOf(a) as Assessment['status'],
    grade: g
      ? { mode: g.mode, percent: g.percent, earned: g.earned, total: g.total }
      : null,
    notes: a.notes ?? '',
  } as Assessment
}

function toDomainCourse(c: CourseRow): DomainCourse {
  return {
    id: c.id,
    code: c.code ?? '',
    title: c.name ?? '',
    term: c.term ?? '',
    credits: c.credits ?? 3,
    color: c.color ?? 'blue',
    archived: !!c.archived,
    finalPercent: c.final_percent ?? undefined,
    finalLetter: c.final_letter ?? undefined,
  } as unknown as DomainCourse
}

/**
 * GPA, from the SAME functions the GPA screen uses.
 *
 * `currentGpa` and `gpaLines` live in src/lib/gpa.ts and carry the rules that
 * are easy to get subtly wrong: Concordia's 4.30 scale, credit weighting, and
 * only-the-latest-attempt for a retaken course. An earlier version of this
 * endpoint did its own weighted average and would have quietly disagreed with
 * the website the first time somebody retook something.
 */
export async function meGpa(userId: string): Promise<{ status: number; json: Json }> {
  const courseRows = (await mine<CourseRow>(userId, 'courses?select=*')) ?? []
  const assignRows = (await liveAssignments(userId)) ?? []

  const courses = courseRows.map(toDomainCourse)
  const assessments = assignRows.map(toDomainAssessment)

  const gpa = currentGpa(courses, assessments)
  const lines = gpaLines(courses, assessments)

  return {
    status: 200,
    json: {
      generated_at: iso(Date.now()),
      timezone: 'UTC',
      gpa,
      scale: 4.3,
      courses: lines.map((l) => ({
        course_id: l.course.id,
        code: l.course.code,
        credits: l.course.credits,
        percent: l.percent,
        letter: l.letter,
        points: l.points,
        // An earlier attempt at a course that was later retaken does not
        // count toward the GPA — Concordia takes the latest.
        superseded: l.superseded,
      })),
      standing: courseRows
        .filter((c) => !c.archived)
        .map((c) => {
          const items = assessments.filter((a) => a.courseId === c.id)
          const s = courseStanding(items)
          return {
            course_id: c.id,
            code: c.code ?? '',
            percent: coursePercent(items),
            graded_weight: s.gradedWeight,
            remaining_weight: s.remainingWeight,
          }
        }),
      notes: [
        'The same functions the GPA screen uses: Concordia’s 4.30 scale, credit-weighted, and only the latest attempt at a retaken course.',
        'A course with nothing graded reports null rather than zero.',
        'Self-reported — this is what has been entered, not an official record.',
      ],
    },
  }
}

/**
 * The calendar, as the calendar screen sees it.
 *
 * Days are bucketed on the LOCAL date, the same way the app does, because
 * `iso.slice(0,10)` reports a 23:59 deadline as the next day in UTC — the bug
 * that once collapsed every week bucket in Radar onto the first.
 */
export async function meCalendar(userId: string, q: Json): Promise<{ status: number; json: Json }> {
  const from = String(q.from ?? '').trim()
  const to = String(q.to ?? '').trim()
  const fromAt = from ? Date.parse(from) : Date.now() - 7 * 86_400_000
  const toAt = to ? Date.parse(to) : Date.now() + 60 * 86_400_000
  if (Number.isNaN(fromAt) || Number.isNaN(toAt)) {
    return { status: 400, json: { error: 'from / to must be ISO-8601 dates.' } }
  }
  if (toAt < fromAt) return { status: 400, json: { error: '`to` is before `from`.' } }

  const [courseRows, assignRows, todoRows] = await Promise.all([
    mine<CourseRow>(userId, 'courses?select=id,code,name,color'),
    liveAssignments(userId),
    mine<{ id: string; title: string; due: string | null; done: boolean | null; source: string | null }>(
      userId,
      'todos?select=id,title,due,done,source',
    ),
  ])
  const byCourse = new Map((courseRows ?? []).map((c) => [c.id, c]))

  const day = (s: string) => {
    const d = new Date(s)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const inRange = (s: string | null) => {
    if (!s) return false
    const t = Date.parse(s)
    return !Number.isNaN(t) && t >= fromAt && t <= toAt
  }

  const items: Json[] = []
  for (const a of assignRows ?? []) {
    if (!inRange(a.date)) continue
    const c = a.course_id ? byCourse.get(a.course_id) : undefined
    items.push({
      kind: 'assignment',
      id: a.id,
      day: day(a.date as string),
      at: iso(a.date as string),
      title: a.title ?? '',
      type: a.type ?? 'assignment',
      weight: a.weight ?? 0,
      status: statusOf(a),
      course: c ? { id: c.id, code: c.code ?? '', name: c.name ?? '', color: c.color ?? 'blue' } : null,
    })
  }
  for (const t of todoRows ?? []) {
    if (!inRange(t.due)) continue
    items.push({
      kind: t.source === 'moodle' ? 'moodle' : 'task',
      id: t.id,
      day: day(t.due as string),
      at: iso(t.due as string),
      title: t.title,
      done: !!t.done,
      source: t.source ?? 'personal',
    })
  }

  items.sort((a, b) => String(a.at).localeCompare(String(b.at)))
  const days = new Map<string, Json[]>()
  for (const i of items) {
    const k = String(i.day)
    if (!days.has(k)) days.set(k, [])
    days.get(k)!.push(i)
  }

  return {
    status: 200,
    json: {
      generated_at: iso(Date.now()),
      timezone: 'UTC',
      from: iso(fromAt),
      to: iso(toAt),
      count: items.length,
      days: [...days.entries()].map(([d, list]) => ({ day: d, items: list })),
      notes: [
        'Days are bucketed on the local date, the way the calendar screen buckets them.',
        'An assignment with no date is not on the calendar, because we do not know when it is.',
        'Concordia’s own academic dates are a published layer, not personal data, and are not included here.',
      ],
    },
  }
}
