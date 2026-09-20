/**
 * /api/v1/me/* — one student's own data, for their own scripts and agents.
 *
 * SCOPE IS THE WHOLE SECURITY MODEL HERE. Every query in this file filters on
 * `user_id = caller.userId`, and the caller id comes from the token row, never
 * from the request. There is no path, parameter or body field that can point
 * at somebody else's row: a `me` token leaking is bad for one person and
 * cannot become bad for anyone else.
 *
 * WHY THE SERVICE ROLE RATHER THAN RLS. An API token is not a Supabase
 * session, so there is no JWT to hand PostgREST and RLS has no `auth.uid()` to
 * work from. The filter is therefore ours to apply, and it is applied in ONE
 * place — `mine()` — rather than remembered at each call site.
 *
 * WRITES ARE THE SAME NARROW SET THE APP ALLOWS: status, grade, notes. Not
 * weights, not dates, not provenance. A weight edited by a script and not by a
 * person is a grade computed from a number nobody checked, and provenance is a
 * claim about where a date came from — a token cannot honestly make it.
 */
import { svc, iso } from './_v1-auth.js'

interface Json {
  [k: string]: unknown
}

/** A PostgREST request as the service role, always scoped to one user. */
async function mine<T>(
  userId: string,
  path: string,
  init?: { method?: string; body?: unknown; prefer?: string },
): Promise<T[] | null> {
  const s = svc()
  if (!s) return null
  const joiner = path.includes('?') ? '&' : '?'
  const res = await fetch(`${s.url}/rest/v1/${path}${joiner}user_id=eq.${userId}`, {
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

interface CourseRow {
  id: string
  code: string | null
  name: string | null
  term: string | null
  credits: number | null
  section: string | null
  professor: string | null
  archived: boolean | null
  final_grade: string | null
}

interface AssignRow {
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
  provenance_status: string | null
  provenance_confirmations: number | null
}

/** The same precedence the app uses, so the API cannot report a different
 *  status than the screen does for the same row. */
function statusOf(r: AssignRow): string {
  if (r.status) return r.status
  if (r.done) return 'done'
  if (r.missed) return 'missed'
  if (r.awaiting_grade) return 'awaiting-grade'
  if (r.extension_granted) return 'extension'
  return 'not-started'
}

interface GradeView {
  mode: 'raw' | 'percent'
  percent: number | null
  earned: number | null
  total: number | null
}

function gradeOf(r: AssignRow): GradeView | null {
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

const course = (c: CourseRow): Json => ({
  id: c.id,
  code: c.code ?? '',
  title: c.name ?? '',
  term: c.term ?? '',
  credits: c.credits ?? 3,
  section: c.section ?? '',
  instructor: c.professor ?? '',
  archived: !!c.archived,
  final_grade: c.final_grade ?? null,
})

const assignment = (a: AssignRow): Json => ({
  id: a.id,
  course_id: a.course_id,
  title: a.title ?? '',
  kind: a.type ?? 'assignment',
  due: a.date ? iso(a.date) : null,
  weight: a.weight ?? 0,
  status: statusOf(a),
  grade: gradeOf(a),
  notes: a.notes ?? '',
  provenance: {
    status: a.provenance_status ?? 'unverified',
    confirmations: a.provenance_confirmations ?? null,
  },
})

export async function meCourses(userId: string, q: Json): Promise<Json> {
  const rows = (await mine<CourseRow>(userId, 'courses?select=*')) ?? []
  const wantArchived = String(q.archived ?? '') === 'true'
  const shown = rows.filter((r) => !!r.archived === wantArchived)
  return {
    generated_at: iso(Date.now()),
    timezone: 'UTC',
    count: shown.length,
    courses: shown.map(course),
  }
}

export async function meAssignments(userId: string, q: Json): Promise<Json> {
  const rows = (await mine<AssignRow>(userId, 'assignments?select=*&order=date.asc')) ?? []
  const courseId = String(q.course_id ?? '').trim()
  const status = String(q.status ?? '').trim()

  let shown = rows
  if (courseId) shown = shown.filter((r) => r.course_id === courseId)
  if (status) shown = shown.filter((r) => statusOf(r) === status)
  // `upcoming=true` means dated and not yet past — an undated item is NOT
  // upcoming, because we do not know that it is.
  if (String(q.upcoming ?? '') === 'true') {
    const now = Date.now()
    shown = shown.filter((r) => r.date && new Date(r.date).getTime() >= now)
  }
  return {
    generated_at: iso(Date.now()),
    timezone: 'UTC',
    count: shown.length,
    assignments: shown.map(assignment),
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

/**
 * PATCH one assignment. Returns the row as it now stands, so a caller never
 * has to guess whether the write landed.
 */
export async function patchAssignment(
  userId: string,
  id: string,
  body: Json,
): Promise<{ status: number; json: Json }> {
  if (!id) return { status: 400, json: { error: 'Which assignment? Give an id in the path.' } }

  const patch: Json = {}

  if ('status' in body) {
    const s = String(body.status ?? '')
    if (!STATUSES.has(s)) {
      return {
        status: 400,
        json: { error: `Unknown status. One of: ${[...STATUSES].join(', ')}.` },
      }
    }
    // The boolean columns predate `status` and other code still reads them, so
    // they are kept in step here rather than left to disagree with it.
    patch.status = s
    patch.done = s === 'done'
    patch.missed = s === 'missed'
    patch.awaiting_grade = s === 'awaiting-grade'
    patch.extension_granted = s === 'extension'
  }

  if ('notes' in body) patch.notes = String(body.notes ?? '').slice(0, 5000)

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
        if (!(total > 0) || earned < 0) {
          return { status: 400, json: { error: 'A raw grade needs earned >= 0 and total > 0.' } }
        }
        patch.raw_score = earned
        patch.raw_total = total
        patch.score = null
      } else if (percent != null) {
        if (!Number.isFinite(percent) || percent < 0 || percent > 1000) {
          return { status: 400, json: { error: 'A percentage grade must be between 0 and 1000.' } }
        }
        patch.score = percent
        patch.raw_score = null
        patch.raw_total = null
      } else {
        return {
          status: 400,
          json: { error: 'Give `grade` as {percent} or {earned,total}, or null to clear it.' },
        }
      }
    }
  }

  if (!Object.keys(patch).length) {
    return { status: 400, json: { error: 'Nothing to change. Send status, grade or notes.' } }
  }

  const rows = await mine<AssignRow>(userId, `assignments?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  })
  if (rows === null) return { status: 502, json: { error: 'The database refused the update.' } }
  if (!rows.length) {
    // The filter includes user_id, so "no rows" means it is not theirs OR it
    // does not exist — and those are deliberately the same answer.
    return { status: 404, json: { error: 'No assignment with that id on your account.' } }
  }
  return { status: 200, json: { updated: assignment(rows[0]) } }
}

/**
 * GPA, per course and overall.
 *
 * COMPUTED THE SAME WAY THE APP COMPUTES IT — a weighted average over the
 * graded weight only, so a term two assessments in is not reported as if the
 * ungraded 80% were zeros. The denominator is stated in the response
 * (`graded_weight`) so nobody has to guess which of the two it is.
 */
export async function meGpa(userId: string): Promise<Json> {
  const courses = (await mine<CourseRow>(userId, 'courses?select=*')) ?? []
  const rows = (await mine<AssignRow>(userId, 'assignments?select=*')) ?? []

  const active = courses.filter((c) => !c.archived)
  const per = active.map((c) => {
    const items = rows.filter((r) => r.course_id === c.id)
    let points = 0
    let graded = 0
    for (const r of items) {
      const g = gradeOf(r)
      const pct = g?.percent
      if (pct == null || !r.weight) continue
      points += (pct * r.weight) / 100
      graded += r.weight
    }
    return {
      course_id: c.id,
      code: c.code ?? '',
      credits: c.credits ?? 3,
      graded_weight: Math.round(graded * 10) / 10,
      percent: graded > 0 ? Math.round((points / graded) * 1000) / 10 : null,
    }
  })

  const scored = per.filter((p) => p.percent != null)
  const credits = scored.reduce((n, p) => n + p.credits, 0)
  const weighted =
    credits > 0 ? scored.reduce((n, p) => n + (p.percent as number) * p.credits, 0) / credits : null

  return {
    generated_at: iso(Date.now()),
    timezone: 'UTC',
    courses: per,
    term_percent: weighted == null ? null : Math.round(weighted * 10) / 10,
    credits_graded: credits,
    notes: [
      'Each course percentage is a weighted average over the weight graded SO FAR, not out of 100.',
      'Courses with nothing graded yet report null rather than zero.',
      'This is what the student has entered; it is not an official record.',
    ],
  }
}
