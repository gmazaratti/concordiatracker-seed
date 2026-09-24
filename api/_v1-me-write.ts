/**
 * The writing half of /api/v1/me — courses, assignments, notes, grades, and
 * a syllabus upload.
 *
 * SPLIT FROM _v1-me.ts because that file was the read side and this one
 * doubles it; ~250 lines is the house limit and one 500-line file called
 * "me" would be the wrong seam. The scoping rule is the same in both and is
 * enforced the same way: every query filters on the user id carried by the
 * TOKEN, never on anything in the request, so there is no path, parameter or
 * body field that can point at somebody else's row.
 */
import { svc, rpcRaw, iso } from './_v1-auth.js'
import { extractOutline, MAX_BYTES } from './_parse-core.js'
import { isPdf, MAX_PAGES, pdfPageCount } from './_parse-guard.js'
import { assignment, course, mine, type AssignRow, type CourseRow } from './_v1-me.js'

interface Json {
  [k: string]: unknown
}

type Out = { status: number; json: Json }

const bad = (error: string, reason = 'bad_request'): Out => ({ status: 400, json: { error, reason } })
const missing = (what: string): Out => ({
  status: 404,
  json: { error: `No ${what} with that id on your account.`, reason: 'not_found' },
})

/* ── Courses ─────────────────────────────────────────────────────────────── */

/**
 * The columns a caller may set, and what they are called in the database.
 *
 * AN ALLOWLIST, NOT A SPREAD. Passing the request body through to PostgREST
 * would let a caller set `user_id` and hand their course to someone else, or
 * set `id` and collide with a row they cannot see. Naming the fields also
 * keeps the API's vocabulary (`name`, `instructor`) stable while the table's
 * own (`name`, `professor`) is free to change.
 */
const COURSE_FIELDS: Record<string, string> = {
  code: 'code',
  name: 'name',
  title: 'name',
  term: 'term',
  semester: 'term',
  credits: 'credits',
  color: 'color',
  section: 'section',
  instructor: 'professor',
  instructor_email: 'prof_email',
  location: 'location',
  meeting_times: 'time',
  office_hours: 'office_hours',
  syllabus_url: 'syllabus_url',
  grading_scale: 'grading_scale',
  enrollment: 'enrollment',
  archived: 'archived',
}

function coursePatch(body: Json): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const [from, to] of Object.entries(COURSE_FIELDS)) {
    if (from in body) patch[to] = body[from]
  }
  return patch
}

export async function createCourse(userId: string, body: Json): Promise<Out> {
  const patch = coursePatch(body)
  if (!patch.code && !patch.name) {
    return bad('A course needs at least a code or a name.')
  }
  // Credits default to 3 only when nothing was given. A WRONG credit count
  // silently breaks the full-time check, the cost estimate and the degree
  // audit at once, so it is never inferred from anything else.
  if (patch.credits == null) patch.credits = 3
  patch.user_id = userId

  const rows = await mine<CourseRow>(userId, 'courses', {
    method: 'POST',
    body: patch,
    prefer: 'return=representation',
    noFilter: true,
  })
  if (!rows?.length) return { status: 502, json: { error: 'The database refused that.' } }
  return { status: 201, json: { course: course(rows[0]) } }
}

export async function getCourse(userId: string, id: string): Promise<Out> {
  if (!id) return bad('Which course?')
  const rows = await mine<CourseRow>(userId, `courses?id=eq.${encodeURIComponent(id)}&select=*`)
  if (!rows?.length) return missing('course')

  const items =
    (await mine<AssignRow>(
      userId,
      `assignments?course_id=eq.${encodeURIComponent(id)}&deleted=eq.false&select=*&order=date.asc`,
    )) ?? []

  const graded = items.filter((a) => a.score != null || (a.raw_score != null && a.raw_total != null))
  return {
    status: 200,
    json: {
      ...course(rows[0]),
      assignments: {
        total: items.length,
        graded: graded.length,
        weight_total: items.reduce((n, a) => n + (a.weight ?? 0), 0),
        items: items.map(assignment),
      },
    },
  }
}

export async function patchCourse(userId: string, id: string, body: Json): Promise<Out> {
  if (!id) return bad('Which course?')
  const patch = coursePatch(body)
  if (!Object.keys(patch).length) {
    return bad(`Nothing to change. Settable: ${Object.keys(COURSE_FIELDS).join(', ')}.`)
  }
  const rows = await mine<CourseRow>(userId, `courses?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  })
  if (!rows?.length) return missing('course')
  return { status: 200, json: { course: course(rows[0]) } }
}

/**
 * Archive by default, delete only when asked.
 *
 * A course with grades in it is a record, and clearing a term to tidy a list
 * is the sort of thing somebody does once and regrets. `?hard=true` really
 * removes it, and the RPC takes its assignments with it — they do not
 * cascade in this schema, so a plain delete would leave rows that still
 * count toward a GPA for a course that no longer exists.
 */
export async function deleteCourse(userId: string, id: string, hard: boolean): Promise<Out> {
  if (!id) return bad('Which course?')
  const res = await rpcRaw('api_delete_course', {
    p_user: userId,
    p_course: id,
    p_archive: !hard,
  })
  if (!res.ok) {
    const err = res.error as { code?: string; message?: string }
    if (err?.code === 'P0002') return missing('course')
    return { status: 500, json: { error: err?.message ?? 'Could not delete that.' } }
  }
  return { status: 200, json: res.data as Json }
}

/* ── Assignments ─────────────────────────────────────────────────────────── */

const KINDS = new Set(['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project'])

export async function createAssignment(userId: string, body: Json): Promise<Out> {
  const title = String(body.title ?? '').trim()
  if (!title) return bad('An assignment needs a title.')

  const courseId = String(body.course_id ?? '').trim()
  if (courseId) {
    const owns = await mine<{ id: string }>(userId, `courses?id=eq.${encodeURIComponent(courseId)}&select=id`)
    // Checked rather than assumed: without this, a caller could file an
    // assignment against a course id they do not own. It would still be
    // THEIR row, but it would be attached to a stranger's course.
    if (!owns?.length) return missing('course')
  }

  const kind = String(body.kind ?? body.type ?? 'assignment')
  if (!KINDS.has(kind)) return bad(`kind must be one of: ${[...KINDS].join(', ')}.`)

  const due = body.due_at ?? body.due ?? null
  if (due != null && Number.isNaN(Date.parse(String(due)))) {
    return bad('due_at must be an ISO-8601 timestamp, or null when the date is unknown.')
  }

  const rows = await mine<AssignRow>(userId, 'assignments', {
    method: 'POST',
    noFilter: true,
    prefer: 'return=representation',
    body: {
      user_id: userId,
      course_id: courseId || null,
      title,
      type: kind,
      // Never invented. An outline that says the Examinations Office will set
      // the date has not given us one.
      date: due == null ? null : new Date(String(due)).toISOString(),
      weight: body.weight == null ? 0 : Number(body.weight),
      notes: String(body.notes ?? ''),
      description: String(body.description ?? ''),
      status: 'not-started',
      // Entered by hand, so it is unverified — the same provenance the app
      // gives a self-entered row.
      provenance_status: 'unverified',
      deleted: false,
    },
  })
  if (!rows?.length) return { status: 502, json: { error: 'The database refused that.' } }
  return { status: 201, json: { assignment: assignment(rows[0]) } }
}

export async function getAssignment(userId: string, id: string): Promise<Out> {
  if (!id) return bad('Which assignment?')
  const rows = await mine<AssignRow>(userId, `assignments?id=eq.${encodeURIComponent(id)}&select=*`)
  if (!rows?.length) return missing('assignment')
  return { status: 200, json: assignment(rows[0]) }
}

/**
 * Soft delete.
 *
 * The column exists and every reader in the app already filters on it, so a
 * removed assignment disappears everywhere without the row going for good.
 * The web app hard-deletes; this diverges deliberately, because a script
 * deleting the wrong row is a likelier accident than a person doing it, and
 * one of the two should be recoverable.
 */
export async function deleteAssignment(userId: string, id: string): Promise<Out> {
  if (!id) return bad('Which assignment?')
  const rows = await mine<AssignRow>(userId, `assignments?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { deleted: true, deleted_at: new Date().toISOString() },
    prefer: 'return=representation',
  })
  if (!rows?.length) return missing('assignment')
  return { status: 200, json: { deleted: true, id } }
}

export async function addNote(userId: string, id: string, body: Json): Promise<Out> {
  if (!id) return bad('Which assignment?')
  const note = String(body.note ?? body.body ?? body.text ?? '').trim()
  if (!note) return bad('Send { "note": "..." }.', 'empty')

  const res = await rpcRaw('api_append_note', { p_user: userId, p_assignment: id, p_note: note })
  if (!res.ok) {
    const err = res.error as { code?: string; message?: string }
    if (err?.code === 'P0002') return missing('assignment')
    return bad(err?.message ?? 'Could not add that note.')
  }
  return { status: 201, json: res.data as Json }
}

/* ── The syllabus upload ─────────────────────────────────────────────────── */

/**
 * Create a course from an outline PDF.
 *
 * SAME EXTRACTOR AS THE WEBSITE — literally the same function, in
 * _parse-core.ts. A second prompt here would mean a student's outline
 * parsing one way in the browser and another way through their assistant,
 * and nobody would notice until the dates disagreed.
 *
 * The body is the PDF bytes, not multipart: there is one file and no fields,
 * and a multipart parser is a dependency plus a boundary to get wrong. A
 * `filename` query parameter covers the only other thing a form would carry.
 */
export async function courseFromOutline(
  userId: string,
  buf: ArrayBuffer,
  mimeType: string,
  q: Json,
): Promise<Out> {
  if (buf.byteLength === 0) return bad('Send the PDF as the request body.')
  if (buf.byteLength > MAX_BYTES) {
    return { status: 413, json: { error: 'That file is too large (max 4 MB).' } }
  }
  // The same gates as the website: a PDF by its own bytes (not by the header
  // the caller chose), and a page cap.
  const bytes = new Uint8Array(buf)
  if (!isPdf(bytes)) return { status: 415, json: { error: 'The body must be a PDF.' } }
  if (pdfPageCount(bytes) > MAX_PAGES) {
    return { status: 413, json: { error: `That PDF has more than ${MAX_PAGES} pages.` } }
  }
  void mimeType

  /*
   * THE SAME LIMITER AS THE WEBSITE. This route used to call the model with no
   * parse limit at all, so a personal token could spend the shared Gemini
   * quota the upload page is careful with. ct_start_parse is the website's
   * start_parse keyed on a user id (the service role has no auth.uid()), so
   * both doors are held to one rule. It fails closed.
   */
  const slotRes = await rpcRaw('ct_start_parse', { p_uid: userId })
  const slot = slotRes.ok
    ? (slotRes.data as { allowed?: boolean; reason?: string; retry_after?: number; event_id?: string })
    : null
  if (!slot) return { status: 503, json: { error: 'Could not check the parse allowance. Try again.' } }
  if (slot.allowed === false) {
    return {
      status: 429,
      json: {
        error: 'Syllabus parsing is rate limited for this account right now.',
        reason: slot.reason ?? 'limited',
        retry_after: slot.retry_after ?? null,
      },
    }
  }

  const started = Date.now()
  const parsed = await extractOutline(buf, 'application/pdf')
  const meta = (extra: Record<string, unknown>) => ({
    source: 'api',
    bytes: buf.byteLength,
    path: parsed.how,
    duration_ms: Date.now() - started,
    ...extra,
  })
  if (!parsed.ok) {
    // Our side of the line (timeout, unreachable, not configured) is handed
    // back; a document the model read and could not use keeps the attempt.
    if (slot.event_id) {
      await rpcRaw('ct_finish_parse', {
        p_event: slot.event_id,
        p_error: parsed.detail ?? parsed.failure ?? 'unknown',
        p_refund: parsed.failure !== 'unreadable',
        p_meta: meta({}),
      })
    }
    const status =
      parsed.failure === 'timeout' ? 504 : parsed.failure === 'not_configured' ? 500 : 502
    return {
      status,
      json: {
        error:
          parsed.failure === 'timeout'
            ? 'The parser ran out of time on that file. That is our ceiling, not the outline.'
            : 'Could not read that outline. Try again.',
        reason: parsed.failure,
      },
    }
  }

  if (slot.event_id) {
    await rpcRaw('ct_parse_succeeded', {
      p_event: slot.event_id,
      p_meta: meta({ items: parsed.assessments.length, course_code: parsed.course?.code || null }),
    })
  }

  const c = parsed.course
  const term = c.term || String(q.term ?? '')

  /*
   * ONE COURSE PER COURSE (db/course_integrity.sql). If the student already has
   * this code in this term, the outline goes INTO it rather than failing on
   * the unique index or making a second copy.
   */
  const key = (v: string | null | undefined) => (v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const termKey = (v: string | null | undefined) => (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
  const theirs = key(c.code)
    ? ((await mine<CourseRow>(userId, 'courses?select=id,code,term,archived')) ?? [])
    : []
  const existing = theirs.find((r) => key(r.code) === key(c.code) && termKey(r.term) === termKey(term))

  const created = existing ? [existing] : await mine<CourseRow>(userId, 'courses', {
    method: 'POST',
    noFilter: true,
    prefer: 'return=representation',
    body: {
      user_id: userId,
      code: c.code ?? '',
      name: c.title ?? '',
      term,
      section: c.section ?? '',
      professor: c.instructorName ?? '',
      prof_email: c.instructorEmail ?? '',
      ta_name: c.taName ?? '',
      ta_email: c.taEmail ?? '',
      grading_scale: c.gradingScale ?? '',
      credits: 3,
      color: 'blue',
    },
  })
  if (!created?.length) return { status: 502, json: { error: 'Could not create the course.' } }
  const courseId = created[0].id

  const rows = parsed.assessments.map((a) => ({
    user_id: userId,
    course_id: courseId,
    title: a.title,
    type: KINDS.has(a.kind) ? a.kind : 'assignment',
    date: a.due ? new Date(a.due).toISOString() : null,
    no_date: a.noDateNeeded && !a.due,
    weight: a.weight ?? 0,
    description: a.description ?? '',
    notes: '',
    status: 'not-started',
    // UNVERIFIED, like every parse on the website. The model read the
    // document; nobody has confirmed what it read, and a machine's reading of
    // a PDF is not the professor's word. Official is earned, not assumed.
    provenance_status: 'unverified',
    deleted: false,
  }))

  const saved = rows.length
    ? ((await mine<AssignRow>(userId, 'assignments', {
        method: 'POST',
        noFilter: true,
        prefer: 'return=representation',
        body: rows,
      })) ?? [])
    : []

  const weight = saved.reduce((n, a) => n + (a.weight ?? 0), 0)
  return {
    status: 201,
    json: {
      created_at: iso(Date.now()),
      course: course(created[0]),
      assignments: saved.map(assignment),
      summary: {
        count: saved.length,
        weight_total: weight,
        // Said out loud: an outline whose weights do not reach 100 is either
        // missing something or has an ungraded component, and either way the
        // student should look rather than assume.
        weight_complete: Math.abs(weight - 100) < 0.5,
        parse_path: parsed.how,
        retried: !!parsed.retried,
      },
      notes: [
        'Dates the outline did not give are null, never guessed.',
        weight === 0
          ? 'No weights were found — check the outline against what was created.'
          : `Weights total ${weight}%.`,
      ],
    },
  }
}

export { svc }
