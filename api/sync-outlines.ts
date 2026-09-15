/**
 * POST /api/sync-outlines — seed verified blueprints from eConcordia.
 *
 * Gated by CRON_SECRET like the other jobs. Two phases, both in one call:
 *
 *   DISCOVER  walk the catalogue (one GET per semester) and record every
 *             course + slug in `outline_sources`.
 *   PARSE     take a small batch of rows that are due a look, GET the PDF,
 *             hash it, and — only when the bytes changed — extract the
 *             assessment scheme and upsert a blueprint.
 *
 * WHY A BATCH. Forty-five PDFs through a model does not fit in one function
 * invocation, and a job that times out halfway writes a partial term and
 * reports success (exactly how the catalogue sync once wrote 1,946 of 7,946
 * rows). So each run does a bounded amount of work and the schedule converges
 * over a few hours. `?limit=` overrides the batch size for a manual run.
 *
 * WHY THE HASH. Outlines are replaced at the start of a term and occasionally
 * corrected mid-term. Re-reading an unchanged PDF costs a model call for no
 * new information, so an unchanged hash ends the work for that course at the
 * GET. That is what makes a six-hourly schedule affordable.
 *
 * WHAT IT NEVER DOES: touch a blueprint somebody uploaded. It writes only rows
 * it owns — `user_id is null and author = 'Course outline'` — so the
 * user-upload path is untouched, and a course with no eConcordia outline
 * (every in-person section, plus the handful of 404 slugs) behaves exactly as
 * it does today.
 */
import {
  CATALOG_URL,
  POLITE_MS,
  SEMESTERS,
  fetchOutline,
  fetchText,
  outlineUrl,
  parseCatalog,
  pdfText,
  semesterLabel,
  sha256,
  sleep,
  termNameFrom,
} from './_econcordia.js'
import { extractOutline, type ExtractedItem } from './_outline-extract.js'
import { fail } from './_respond.js'

export const config = { maxDuration: 60 }

/** PDFs per run. Each is a GET plus, when it changed, one model call. */
const BATCH = 6

/** Re-check a course we already have at most this often. */
const RECHECK_HOURS = 20

interface SourceRow {
  slug: string
  semester: string
  term: string | null
  course_codes: string[]
  title: string | null
  pdf_url: string
  status: string
  content_hash: string | null
  last_checked_at: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  /**
   * GET as well as POST, because **Vercel Cron sends GET** — and that is how
   * this job is scheduled now. Vercel attaches `Authorization: Bearer
   * $CRON_SECRET` to its own cron invocations automatically, which is exactly
   * the check below, so nobody ever has to hold the secret to keep this
   * running. pg_cron stays supported for anyone who prefers it.
   */
  if (req.method !== 'POST' && req.method !== 'GET') {
    fail(res, 405, 'Method not allowed')
    return
  }
  const cronSecret = process.env.CRON_SECRET
  const header: string = req.headers['authorization'] || ''
  if (!cronSecret || header.slice(7) !== cronSecret) {
    fail(res, 401, 'Unauthorized')
    return
  }
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    fail(res, 500, 'Supabase is not configured.')
    return
  }
  const db = rest(url, key)
  const limit = Number(req.query?.limit) || BATCH
  const only = typeof req.query?.semester === 'string' ? req.query.semester : null

  try {
    const discovered = req.query?.phase === 'parse' ? 0 : await discover(db, only)
    const parsed = req.query?.phase === 'discover' ? [] : await parseBatch(db, limit)
    res.status(200).json({
      ok: true,
      discovered,
      parsed: parsed.length,
      results: parsed,
    })
  } catch (e) {
    fail(res, 502, e instanceof Error ? e.message : 'Outline sync failed.')
  }
}

/** Thin PostgREST helper — the same shape sync-catalog uses. */
function rest(url: string, key: string) {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  return {
    async select<T>(path: string): Promise<T[]> {
      const r = await fetch(`${url}/rest/v1/${path}`, { headers })
      if (!r.ok) throw new Error(`select ${path}: ${r.status} ${await r.text()}`)
      return (await r.json()) as T[]
    },
    async upsert(table: string, rows: unknown[], onConflict: string): Promise<void> {
      if (rows.length === 0) return
      const r = await fetch(`${url}/rest/v1/${table}?on_conflict=${onConflict}`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      })
      if (!r.ok) throw new Error(`upsert ${table}: ${r.status} ${await r.text()}`)
    },
    async patch(table: string, query: string, patch: unknown): Promise<void> {
      const r = await fetch(`${url}/rest/v1/${table}?${query}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify(patch),
      })
      if (!r.ok) throw new Error(`patch ${table}: ${r.status} ${await r.text()}`)
    },
    async del(table: string, query: string): Promise<void> {
      const r = await fetch(`${url}/rest/v1/${table}?${query}`, { method: 'DELETE', headers })
      if (!r.ok) throw new Error(`delete ${table}: ${r.status} ${await r.text()}`)
    },
  }
}
type Db = ReturnType<typeof rest>

/**
 * Walk the catalogue.
 *
 * Only ever ADDS or refreshes the listing fields — never resets a status or a
 * hash, or every run would re-parse the whole term.
 */
async function discover(db: Db, only: string | null): Promise<number> {
  const semesters = only ? SEMESTERS.filter((s) => s.id === only) : SEMESTERS
  const rows: Record<string, unknown>[] = []
  const seen = new Set<string>()

  for (const sem of semesters) {
    await sleep(POLITE_MS)
    const html = await fetchText(`${CATALOG_URL}?semester=${encodeURIComponent(sem.id)}`)
    const term = termNameFrom(sem.season, semesterLabel(html, sem.id))
    for (const c of parseCatalog(html, sem.id)) {
      // A course can be listed under more than one semester id; first wins, so
      // the term recorded is the one we actually read it from.
      if (seen.has(c.slug)) continue
      seen.add(c.slug)
      rows.push({
        slug: c.slug,
        semester: c.semester,
        term,
        course_codes: c.codes,
        title: c.title,
        pdf_url: outlineUrl(c.slug),
      })
    }
  }
  await db.upsert('outline_sources', rows, 'slug')
  return rows.length
}

/** The courses most worth looking at: never checked first, then stalest. */
async function parseBatch(db: Db, limit: number): Promise<Record<string, string>[]> {
  const cutoff = new Date(Date.now() - RECHECK_HOURS * 3600_000).toISOString()
  const due = await db.select<SourceRow>(
    `outline_sources?or=(last_checked_at.is.null,last_checked_at.lt.${cutoff})` +
      `&order=last_checked_at.nullsfirst&limit=${limit}`,
  )

  const out: Record<string, string>[] = []
  for (const row of due) {
    await sleep(POLITE_MS)
    out.push({ slug: row.slug, status: await parseOne(db, row) })
  }
  return out
}

async function parseOne(db: Db, row: SourceRow): Promise<string> {
  const stamp = { last_checked_at: new Date().toISOString() }
  const mark = (patch: Record<string, unknown>) =>
    db.patch('outline_sources', `slug=eq.${encodeURIComponent(row.slug)}`, { ...stamp, ...patch })

  const got = await fetchOutline(row.pdf_url)
  if (got.status !== 200 || !got.bytes) {
    // Not an error: five Fall slugs have no outline at all, and a course
    // without one simply keeps using the upload flow.
    await mark({ status: 'missing', last_error: `HTTP ${got.status}` })
    return 'missing'
  }

  const hash = await sha256(got.bytes)
  if (hash === row.content_hash && row.status === 'ok') {
    await mark({})
    return 'unchanged'
  }

  const text = await pdfText(got.bytes)
  if (text.trim().length < 400) {
    // A scanned outline. Saying so beats writing an empty blueprint.
    await mark({ status: 'no_text', content_hash: hash, last_error: 'No extractable text' })
    return 'no_text'
  }

  let items: ExtractedItem[]
  let meta: { professor?: string; professorEmail?: string; term?: string }
  try {
    const got2 = await extractOutline(text, row.course_codes[0] ?? '', row.term ?? '')
    items = got2.items
    meta = got2
  } catch (e) {
    await mark({
      status: 'parse_failed',
      content_hash: hash,
      last_error: e instanceof Error ? e.message.slice(0, 300) : 'extract failed',
    })
    return 'parse_failed'
  }

  const total = items.reduce((n, i) => n + (i.weight ?? 0), 0)
  if (items.length === 0 || total < 95 || total > 105) {
    // A scheme that does not add up is a scheme we read wrong. Publishing it
    // would put wrong weights behind a verified badge, which is worse than
    // publishing nothing — the student would trust it.
    await mark({
      status: 'parse_failed',
      content_hash: hash,
      last_error: `weights total ${total} across ${items.length} items`,
    })
    return 'parse_failed'
  }

  const term = meta.term || row.term
  if (!term) {
    await mark({ status: 'parse_failed', content_hash: hash, last_error: 'no term' })
    return 'parse_failed'
  }

  // One blueprint per code: a cross-listed card is one outline that two sets
  // of students need to find.
  for (const code of row.course_codes) {
    await db.del(
      'shared_blueprints',
      `user_id=is.null&author=eq.Course%20outline&course_code=eq.${encodeURIComponent(code)}` +
        `&term=eq.${encodeURIComponent(term)}`,
    )
    await db.upsert(
      'shared_blueprints',
      [
        {
          user_id: null,
          course_code: code,
          course_name: row.title,
          professor: meta.professor ?? null,
          professor_email: meta.professorEmail ?? null,
          author: 'Course outline',
          section: null,
          term,
          items,
          verified: true,
          source_url: row.pdf_url,
        },
      ],
      'id',
    )
  }

  await mark({ status: 'ok', content_hash: hash, last_error: null, last_parsed_at: new Date().toISOString() })
  return 'ok'
}
