/**
 * Mirror Concordia's section schedule, one subject-term at a time.
 *
 * NOT ROUTED. The leading underscore keeps it off Vercel's function count
 * (Hobby allows twelve and we are at the ceiling); `api/sync-catalog.ts`
 * dispatches here on `?job=sections`, the same way it already does for
 * outlines.
 *
 * THE ENDPOINT. `course/scheduleTerm/filter/{subject}/{termcode}` returns a
 * whole subject for a named term — measured at 359 rows for COMP in 1.8s.
 * The per-course endpoint we used before needed one request per course and
 * only served a rolling window of terms, so a term we did not capture was
 * gone for good.
 *
 * BOUNDED, AND IT RESUMES. 277 subjects is roughly eight minutes of wall
 * clock, which does not fit one invocation. Each run takes the stalest N from
 * `section_sync_state`, writes what it gets, and records the outcome per
 * subject — so a run that dies halfway leaves a ledger the next one picks up
 * from, rather than a half-written term reported as a success.
 *
 * AN EMPTY SUBJECT IS RECORDED, NOT SKIPPED. "Concordia returned nothing for
 * PHIL in Fall 2026" is a fact worth keeping: it is the difference between a
 * term nobody has published and a sync that never ran.
 *
 * IT REFUSES TO WIPE. If a subject comes back empty we leave whatever is
 * already stored for it, because a transient upstream failure that returns
 * `[]` must not delete a term we already have. Same rule as the catalogue
 * sync.
 */
import { createClient } from '@supabase/supabase-js'
import { fail } from './_respond.js'

const BASE = 'https://opendata.concordia.ca/API/v1'
/** Subjects per invocation. Sized off the measured ~1.8s per call against a
 *  60s serverless ceiling, with headroom for the writes. */
const BATCH = 12

interface TermRow {
  classNumber?: string | number
  meetingPatternNumber?: string | number
  termCode?: string
  subject?: string
  catalog?: string
  courseTitle?: string
  section?: string
  componentCode?: string
  componentDescription?: string
  session?: string
  career?: string
  enrollmentCapacity?: number | string
  currentEnrollment?: number | string
  waitlistCapacity?: number | string
  currentWaitlistTotal?: number | string
  hasSeatReserved?: string
  classStatus?: string
  classStartTime?: string
  classEndTime?: string
  classStartDate?: string
  classEndDate?: string
  /** Concordia's own spelling. Not a typo on our side — do not "fix" it. */
  modays?: string
  tuesdays?: string
  wednesdays?: string
  thursdays?: string
  fridays?: string
  saturdays?: string
  sundays?: string
  locationCode?: string
  buildingCode?: string
  room?: string
  instructionModeDescription?: string
  departmentDescription?: string
  facultyDescription?: string
}

const yes = (v: unknown) => String(v ?? '').trim().toUpperCase() === 'Y'
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
/** Concordia sends `2026-01-12` or an empty string. */
const date = (v: unknown) => {
  const s = String(v ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}
const text = (v: unknown) => {
  const s = String(v ?? '').trim()
  return s === '' ? null : s
}

function auth(): string {
  const user = process.env.CONCORDIA_API_USER
  const key = process.env.CONCORDIA_API_KEY
  if (!user || !key) throw new Error('CONCORDIA_API_USER / CONCORDIA_API_KEY are not set')
  return 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64')
}

async function fetchSubject(subject: string, term: string): Promise<TermRow[]> {
  const res = await fetch(`${BASE}/course/scheduleTerm/filter/${subject}/${term}`, {
    headers: { Authorization: auth(), Accept: 'application/json' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = (await res.json()) as unknown
  return Array.isArray(body) ? (body as TermRow[]) : []
}

function toRow(r: TermRow, term: string) {
  return {
    term_code: String(r.termCode ?? term),
    class_number: String(r.classNumber ?? ''),
    // Part of the key: a class with several meeting patterns repeats its
    // class number once per pattern.
    meeting_pattern_number: num(r.meetingPatternNumber) ?? 1,
    subject: String(r.subject ?? '').toUpperCase(),
    catalog: String(r.catalog ?? '').trim(),
    course_title: text(r.courseTitle),
    section: text(r.section),
    component_code: text(r.componentCode),
    component_description: text(r.componentDescription),
    session: text(r.session),
    career: text(r.career),
    enrollment_capacity: num(r.enrollmentCapacity),
    current_enrollment: num(r.currentEnrollment),
    waitlist_capacity: num(r.waitlistCapacity),
    current_waitlist: num(r.currentWaitlistTotal),
    has_seat_reserved: yes(r.hasSeatReserved),
    class_status: text(r.classStatus),
    class_start_time: text(r.classStartTime),
    class_end_time: text(r.classEndTime),
    class_start_date: date(r.classStartDate),
    class_end_date: date(r.classEndDate),
    mondays: yes(r.modays),
    tuesdays: yes(r.tuesdays),
    wednesdays: yes(r.wednesdays),
    thursdays: yes(r.thursdays),
    fridays: yes(r.fridays),
    saturdays: yes(r.saturdays),
    sundays: yes(r.sundays),
    location_code: text(r.locationCode),
    building_code: text(r.buildingCode),
    room: text(r.room),
    instruction_mode_description: text(r.instructionModeDescription),
    department_description: text(r.departmentDescription),
    faculty_description: text(r.facultyDescription),
    synced_at: new Date().toISOString(),
  }
}

// `any` to match the sibling jobs: Vercel's own types are not a dependency
// here, and the handler signature is whatever the platform hands us.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncSections(req: any, res: any) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return fail(res, 500, 'Supabase is not configured.')
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  const term = String(req.query.term ?? '').trim()
  if (!/^\d{4}$/.test(term)) {
    return fail(res, 400, 'Pass ?term=2254 (a four-digit Concordia term code).', {
      hint: 'Winter 2026 is 2254. Fall 2026 is 2262, though Concordia has not published it.',
    })
  }

  // The subject list comes from the catalogue mirror rather than a hard-coded
  // array, so a new subject is picked up the next time the catalogue syncs.
  // An RPC, not a select: PostgREST caps a plain query at 1000 rows and
  // course_catalog holds 7,884, so reading it directly saw 32 subjects and
  // reported a clean run over an eighth of the university.
  const { data: subjRows, error: subjErr } = await db.rpc('catalog_subjects')
  if (subjErr) return fail(res, 500, subjErr.message, { hint: 'catalog_subjects() is in db/course_sections.sql.' })
  const subjects = [...new Set((subjRows ?? []).map((x: unknown) => String(x).toUpperCase()))].sort()
  if (subjects.length === 0) {
    return fail(res, 409, 'course_catalog has no subjects.', {
      hint: 'Run /api/sync-catalog first to populate the course mirror.',
    })
  }

  // Seed the ledger for this term, then take the stalest batch.
  await db
    .from('section_sync_state')
    .upsert(
      subjects.map((s) => ({ subject: s, term_code: term })),
      { onConflict: 'subject,term_code', ignoreDuplicates: true },
    )

  const { data: due } = await db
    .from('section_sync_state')
    .select('subject, synced_at')
    .eq('term_code', term)
    .order('synced_at', { ascending: true, nullsFirst: true })
    .limit(BATCH)

  const batch = (due ?? []).map((r) => String(r.subject))
  let wrote = 0
  let empty = 0
  const failed: { subject: string; error: string }[] = []

  for (const subject of batch) {
    try {
      const rows = await fetchSubject(subject, term)
      if (rows.length === 0) {
        // Recorded, not skipped, and NOTHING is deleted — an upstream blip
        // that answers `[]` must not wipe a term we already hold.
        empty++
        await db
          .from('section_sync_state')
          .upsert(
            { subject, term_code: term, rows: 0, status: 'empty', error: null, synced_at: new Date().toISOString() },
            { onConflict: 'subject,term_code' },
          )
        continue
      }
      // Deduped on the key before the upsert as well as keyed on it: if
      // Concordia ever repeats a (class, pattern) pair, ON CONFLICT would
      // refuse the whole statement rather than the one row.
      const seen = new Set<string>()
      const mapped = rows
        .map((r) => toRow(r, term))
        .filter((r) => r.class_number && r.subject)
        .filter((r) => {
          const k = `${r.class_number}|${r.meeting_pattern_number}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      for (let i = 0; i < mapped.length; i += 500) {
        const { error } = await db
          .from('course_sections')
          .upsert(mapped.slice(i, i + 500), { onConflict: 'term_code,class_number,meeting_pattern_number' })
        if (error) throw new Error(error.message)
      }
      wrote += mapped.length
      await db
        .from('section_sync_state')
        .upsert(
          { subject, term_code: term, rows: mapped.length, status: 'ok', error: null, synced_at: new Date().toISOString() },
          { onConflict: 'subject,term_code' },
        )
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      failed.push({ subject, error: message })
      await db
        .from('section_sync_state')
        .upsert(
          { subject, term_code: term, status: 'error', error: message.slice(0, 300), synced_at: new Date().toISOString() },
          { onConflict: 'subject,term_code' },
        )
    }
  }

  const { count: remaining } = await db
    .from('section_sync_state')
    .select('subject', { count: 'exact', head: true })
    .eq('term_code', term)
    .is('synced_at', null)

  return res.status(200).json({
    term,
    subjects_total: subjects.length,
    batch: batch.length,
    sections_written: wrote,
    subjects_empty: empty,
    failed,
    remaining_never_synced: remaining ?? 0,
    // Said out loud so nobody reads one 200 as "the term is mirrored".
    note:
      (remaining ?? 0) > 0
        ? `Call again to continue; ${remaining} subjects have never been synced for this term.`
        : 'Every subject has been synced at least once for this term.',
  })
}
