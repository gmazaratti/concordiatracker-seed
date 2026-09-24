/**
 * POST /api/parse-syllabus — server-side syllabus extraction.
 *
 * Receives a PDF as the raw request body (Content-Type: application/pdf) and a
 * Supabase access token in `Authorization: Bearer <token>`, and returns the
 * structured { course, assessments }.
 *
 * THE EXTRACTION ITSELF LIVES IN _parse-core.ts. The personal API runs the
 * same one, and two copies of a prompt drift — after which a student's
 * outline parses one way through the website and another way through their
 * assistant. What stays here is what is genuinely this endpoint's: who may
 * call it, what it costs them against the rate limit, and how a failure is
 * worded to a person who is mid-upload and waiting.
 *
 * The Google API key lives only as a server env var (GEMINI_API_KEY, NOT
 * VITE_-prefixed), so it never reaches the browser bundle. Runs on the Edge
 * runtime — fetch / Request / Response are all standard, no Node deps.
 */
import { extractOutline, MAX_BYTES } from './_parse-core.js'
import { isPdf, MAX_PAGES, pdfPageCount } from './_parse-guard.js'

export const config = { runtime: 'edge' }




function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** ArrayBuffer → base64, chunked so large buffers don't overflow the call stack. */

interface Slot {
  allowed?: boolean
  reason?: string
  retry_after?: number
  used?: number
  /** null on a paid plan: there is no monthly cap to report. */
  limit?: number | null
  resets_at?: string
  event_id?: string
  pro?: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Call a Supabase RPC with the user's JWT (so auth.uid() resolves inside it). */
async function callRpc(name: string, body: unknown, url: string, anon: string, token: string): Promise<Slot | null> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: anon, Authorization: `Bearer ${token}` },
      body: JSON.stringify(body ?? {}),
    })
    if (!r.ok) return null
    return (await r.json()) as Slot
  } catch {
    return null
  }
}

function rateLimitMessage(slot: Slot | null): string {
  if (slot?.reason === 'monthly') {
    let reset = 'next month'
    if (slot.resets_at) {
      const d = new Date(slot.resets_at)
      reset = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
    }
    return `You've reached this month's limit of ${slot.limit ?? 5} syllabus uploads on the free plan. Resets ${reset}, or the Semester pass removes the limit.`
  }
  /**
   * The paid ceiling is an ABUSE STOP, and the wording has to admit that.
   *
   * Forty in a day is a script, not a term's worth of syllabi. Telling a
   * paying student they "reached their limit" would be repeating the exact
   * false claim this whole change exists to undo -- they were sold unlimited
   * and there is no allowance for them to have used up.
   */
  // Every plan: ten model calls an hour. Worded as what it is, a pause on a
  // burst, not an allowance they spent.
  if (slot?.reason === 'hourly') {
    const mins = Math.max(1, Math.ceil(Number(slot.retry_after ?? 3600) / 60))
    return `That is ${slot.used ?? 10} syllabus uploads in the last hour, so parsing is paused for about ${mins} minute${mins === 1 ? '' : 's'}. Nothing is lost: try again then.`
  }
  if (slot?.reason === 'daily') {
    return `That is ${slot.used ?? 40} syllabus uploads in a day, which is far past normal use, so we have paused parsing on this account for a few hours. If that was really you, reply to a support ticket and we will lift it.`
  }
  const secs = Number(slot?.retry_after ?? 180)
  if (secs < 60) return `Please wait ${secs}s before uploading another syllabus.`
  const mins = Math.ceil(secs / 60)
  return `Please wait ${mins} minute${mins === 1 ? '' : 's'} before uploading another syllabus.`
}

/**
 * Turn the model's failure into something a student can act on.
 *
 * Every non-ok response used to collapse into "The parser had trouble reading
 * that file." — which names no cause, suggests no fix, and is wrong about half
 * the time (an exhausted API key is not a problem with your file). Google's
 * error body carries a status and a message; these are the cases worth
 * distinguishing, and anything unrecognised carries the HTTP status through so
 * it can at least be reported rather than guessed at.
 */
function geminiReason(status: number, body: string): string {
  let detail = ''
  try {
    const e = JSON.parse(body) as { error?: { message?: string; status?: string } }
    detail = e.error?.message ?? ''
    const code = e.error?.status ?? ''
    if (code === 'RESOURCE_EXHAUSTED' || status === 429) {
      return 'The parser is out of capacity for the moment. Try again shortly — this one is on us, not your file.'
    }
    if (code === 'PERMISSION_DENIED' || code === 'UNAUTHENTICATED' || status === 403) {
      return 'The parser is misconfigured on our side (the key was rejected). Nothing is wrong with your file.'
    }
    if (/safety|blocked/i.test(detail)) {
      return 'The model refused to read that document. If it is a normal course outline, send it to support and we will look.'
    }
    if (/exceeds the maximum|too large|payload/i.test(detail)) {
      return 'That PDF is too big for the parser. Export just the outline pages and try again.'
    }
    if (/mime|unsupported|invalid.*type/i.test(detail)) {
      return 'The parser could not open that file type. It needs a real PDF — a scan saved as a PDF works, a .doc does not.'
    }
  } catch {
    /* not JSON — fall through to the generic form with the status attached */
  }
  const trimmed = detail.slice(0, 140)
  return `The parser failed on that file (error ${status}${trimmed ? `: ${trimmed}` : ''}).`
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const apiKey = process.env.GEMINI_API_KEY
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!apiKey || !supabaseUrl || !supabaseAnon) {
    return json({ error: 'Server is not configured for parsing.' }, 500)
  }

  // 1. Require a signed-in user (so randoms can't burn the quota). Verify the
  //    token directly against Supabase's auth endpoint — no SDK on the Edge.
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return json({ error: 'Sign in to parse a syllabus.' }, 401)
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnon },
  })
  if (!who.ok) return json({ error: 'Your session expired — sign in again.' }, 401)

  // 2. Read the PDF bytes (sent raw, not base64, so the wire stays small).
  const buf = await req.arrayBuffer()
  if (buf.byteLength === 0) return json({ error: 'No file received.' }, 400)
  if (buf.byteLength > MAX_BYTES) return json({ error: 'That file is too large (max 4 MB).' }, 413)
  // PDF is the one format supported, decided by the file's own first bytes —
  // the Content-Type header is whatever the client chose to send, and it used
  // to be handed to the model as the file's type.
  const bytes = new Uint8Array(buf)
  if (!isPdf(bytes)) return json({ error: 'That is not a PDF. Upload the outline as a PDF file.' }, 415)
  if (pdfPageCount(bytes) > MAX_PAGES) {
    return json(
      { error: `That PDF has more than ${MAX_PAGES} pages. Upload just the course outline.` },
      413,
    )
  }
  const mimeType = 'application/pdf'

  // 3. Rate limit (cooldown, hourly, monthly/daily caps), enforced in the DB — this is the
  //    only path to Gemini, so a user can't spam it or starve the shared quota.
  const slot = await callRpc('start_parse', {}, supabaseUrl, supabaseAnon, token)
  // FAIL CLOSED. This used to run the model whenever the limiter did not
  // answer, which made "the database is slow" the same as "no limit" — the
  // one moment a burst could spend the shared key unchecked.
  if (!slot) {
    return json({ error: 'Couldn’t check your upload allowance just now. Try again in a moment.' }, 503)
  }
  if (slot?.reason === 'auth') return json({ error: 'Your session expired — sign in again.' }, 401)
  if (slot && slot.allowed === false) return json({ error: rateLimitMessage(slot) }, 429)

  /**
   * Hand the slot back when the failure was on our side of the line.
   *
   * The attempt is recorded BEFORE the model runs — it has to be, or two
   * requests race past the limiter. The bug was that it was never given back:
   * a parse that died because our dependency was down still cost a full
   * cooldown, so the student was locked out over a failure they did not cause
   * and were told nothing about. (A file the model read and could not make
   * sense of still keeps the attempt — it burned a real call — but the DB now
   * charges 20s for that rather than 180.)
   */
  const release = async (reason: string) => {
    if (!slot?.event_id) return
    // Record the reason FIRST. `cancel_parse` used to delete the row, which
    // threw away the only evidence of what went wrong — a 32% failure rate
    // that was impossible to diagnose. It now marks the row refunded instead,
    // so the cooldown is excused and the reason survives.
    await callRpc('fail_parse', { p_event: slot.event_id, p_error: reason }, supabaseUrl, supabaseAnon, token)
    await callRpc('cancel_parse', { p_event: slot.event_id }, supabaseUrl, supabaseAnon, token)
  }

  /**
   * 3b. Read the PDF OURSELVES first.
   *
   * THIS is why a 478KB outline timed out: handing Gemini the raw PDF makes it
   * do the document parsing as well as the extraction, and on a long syllabus
   * that alone outruns the platform's ceiling. We already own a text extractor
   * (`pdfText`, the one behind the eConcordia sync — 44 of 45 real outlines
   * come out clean), it is pure string work, and it costs no model time.
   *
   * The PDF is still the fallback, because a scanned document has no text
   * layer at all and only the model can read it. So: text when we have it,
   * pixels when we do not — never a failure just because the fast path missed.
   */
  /**
   * 3b. EXTRACT. The prompt, the schema, the text-before-pixels decision and
   * the model call all live in _parse-core.ts, because the personal API runs
   * the same extraction and two copies of a prompt drift — after which a
   * student's outline parses one way through the website and another way
   * through their assistant.
   *
   * What stays here is what is genuinely this endpoint's: who is allowed to
   * call it, what it costs them, and how a failure is worded to a person
   * mid-upload.
   */
  const parsed = await extractOutline(buf, mimeType)

  if (!parsed.ok) {
    await release(parsed.detail ?? parsed.failure ?? 'unknown')
    if (parsed.failure === 'not_configured') {
      return json({ error: 'Server is not configured for parsing.' }, 500)
    }
    if (parsed.failure === 'timeout') {
      // NOT "try a shorter PDF". That was our timeout described as the
      // student's fault, and it sent someone off trimming a two-page file
      // that was never the problem. Length is not the variable; say so.
      return json(
        {
          error:
            'The parser ran out of time on that file. That is our ceiling, not your outline — try again, and if it keeps happening send it to support. This attempt didn’t count against you.',
        },
        504,
      )
    }
    if (parsed.failure === 'unreachable') {
      return json({ error: 'Could not reach the parser. Try again — this one is on us.' }, 502)
    }
    if (parsed.failure === 'upstream') {
      const status = parsed.upstreamStatus ?? 502
      return json({ error: geminiReason(status, parsed.detail ?? '') }, status === 429 ? 429 : 502)
    }
    return json(
      { error: 'The parser returned something we could not read. Try again.' },
      502,
    )
  }

  /*
   * MARK IT SUCCESSFUL. Nothing called finish_parse after the extractor moved
   * into _parse-core.ts (2026-09-18), so every parse since was recorded as a
   * failure — and the free monthly cap, the free 180s cooldown and the Pro
   * daily ceiling all count SUCCESSES, so none of them had fired since.
   */
  if (slot.event_id) await callRpc('finish_parse', { p_event: slot.event_id }, supabaseUrl, supabaseAnon, token)

  // Already narrowed by cleanParse. Returned to THIS student only: nothing here
  // is written anywhere — it becomes their own course's rows when they confirm.
  const out = { course: parsed.course, assessments: parsed.assessments, warnings: parsed.warnings ?? [] }

  return json(out)
}
