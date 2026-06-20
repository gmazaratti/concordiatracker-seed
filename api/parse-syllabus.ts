/**
 * POST /api/parse-syllabus — server-side syllabus extraction.
 *
 * Receives a PDF as the raw request body (Content-Type: application/pdf) and a
 * Supabase access token in `Authorization: Bearer <token>`. Verifies the user is
 * signed in, then sends the PDF to Gemini 2.5 Flash with a strict prompt +
 * JSON-schema-enforced output, and returns the structured { course, assessments }.
 *
 * The Google API key lives ONLY here as a server env var (GEMINI_API_KEY, NOT
 * VITE_-prefixed), so it never reaches the browser bundle. Runs on the Edge
 * runtime — fetch / Request / Response / btoa are all standard, no Node deps.
 */
export const config = { runtime: 'edge' }

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_BYTES = 4 * 1024 * 1024 // 4 MB — syllabi are tiny; bounds Edge body + quota

const PROMPT = `You are an expert at reading university course syllabi and extracting the graded assessment schedule. You will receive a course syllabus as a PDF. Extract the course identity and EVERY graded assessment into the exact JSON schema provided.

Rules:
- Extract ONLY graded items — anything that contributes to the final grade (assignments, quizzes, tests, midterms, finals, labs, projects, graded reading responses, participation if it carries weight). Ignore lecture topics, ungraded readings, and office hours.
- title: the assessment's name as written (e.g., "Assignment 2", "Midterm Exam", "Quiz 3 — Linked Lists").
- kind: choose the SINGLE closest value from the allowed set. Guidance: a major mid-semester exam → "midterm"; the cumulative end-of-term exam → "final"; short recurring tests → "quiz"; written/programming deliverables → "assignment"; lab work → "lab"; larger multi-week deliverables → "project"; graded reading responses → "reading".
- due: the deadline as an ISO 8601 date (YYYY-MM-DD), or datetime if a time is given. Resolve partial dates using the course term and year (e.g., "Oct 3" in a Fall 2026 course → "2026-10-03"). If the date is genuinely unknown, "TBA", or not derivable from the document, set due to null — do NOT guess.
- weight: the percent of the final grade as a number from 0 to 100 (e.g., 15 for "15%"). If given as a range, use the midpoint. If no weight is stated, set null.
- description: one or two FACTUAL sentences from the syllabus describing the assessment — what it covers, its format, sub-parts, or where it takes place. Use only information present in the document; never invent details. If nothing descriptive is available, use an empty string.
- For the course, extract:
  - code (e.g., "COMP 248"), title, term (e.g., "Fall 2026"), and section — the section identifier, e.g., "BB", "001", "Section A".
  - instructorName and instructorEmail — the professor's full name and email address.
  - taName and taEmail — the teaching assistant's name and email, ONLY if a TA is listed; otherwise leave both as empty strings.
  - gradingScale — the letter-grade scale or grade cutoffs if the syllabus states one (e.g., "A: 90-100, A-: 85-89, B+: 80-84, ..."), as a single concise line; otherwise an empty string.
  Use empty strings for anything not found. Never invent contact details or a grading scale.
- If the document is not a syllabus, or contains no graded assessments, return an empty "assessments" array.

Return ONLY the JSON object. No commentary, no markdown, no code fences.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    course: {
      type: 'OBJECT',
      properties: {
        code: { type: 'STRING' },
        title: { type: 'STRING' },
        term: { type: 'STRING' },
        section: { type: 'STRING' },
        instructorName: { type: 'STRING' },
        instructorEmail: { type: 'STRING' },
        taName: { type: 'STRING' },
        taEmail: { type: 'STRING' },
        gradingScale: { type: 'STRING' },
      },
    },
    assessments: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          kind: {
            type: 'STRING',
            enum: ['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project'],
          },
          due: { type: 'STRING', nullable: true },
          weight: { type: 'NUMBER', nullable: true },
          description: { type: 'STRING' },
        },
        required: ['title', 'kind', 'description'],
      },
    },
  },
  required: ['assessments'],
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** ArrayBuffer → base64, chunked so large buffers don't overflow the call stack. */
function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

interface Slot {
  allowed?: boolean
  reason?: string
  retry_after?: number
  used?: number
  limit?: number
  resets_at?: string
  event_id?: string
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
    return `You've reached this month's limit of ${slot.limit ?? 5} syllabus uploads. Resets ${reset}.`
  }
  const secs = Number(slot?.retry_after ?? 180)
  if (secs < 60) return `Please wait ${secs}s before uploading another syllabus.`
  const mins = Math.ceil(secs / 60)
  return `Please wait ${mins} minute${mins === 1 ? '' : 's'} before uploading another syllabus.`
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
  const mimeType = req.headers.get('content-type') || 'application/pdf'

  // 3. Rate limit (cooldown + monthly cap), enforced in the DB — this is the
  //    only path to Gemini, so a user can't spam it or starve the shared quota.
  // Fail OPEN when there's no verdict (RPC missing pre-migration, or a transient
  // DB error) — only block on an explicit denial, so the feature stays available.
  const slot = await callRpc('start_parse', {}, supabaseUrl, supabaseAnon, token)
  if (slot?.reason === 'auth') return json({ error: 'Your session expired — sign in again.' }, 401)
  if (slot && slot.allowed === false) return json({ error: rateLimitMessage(slot) }, 429)

  // 4. Ask Gemini to extract, constrained to the schema.
  let gemini: Response
  try {
    gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inlineData: { mimeType, data: toBase64(buf) } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
          },
        }),
      },
    )
  } catch {
    return json({ error: 'Could not reach the parser. Try again.' }, 502)
  }

  if (gemini.status === 429) return json({ error: 'Busy right now — try again in a moment.' }, 429)
  if (!gemini.ok) return json({ error: 'The parser had trouble reading that file.' }, 502)

  const result = (await gemini.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  const text = result.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) return json({ error: 'Couldn’t extract anything from that file.' }, 422)

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return json({ error: 'The parser returned an unexpected format. Try again.' }, 502)
  }
  // Count this as a successful parse (toward the monthly cap) — only if a slot
  // was actually claimed (skipped when the limiter is unmigrated / failed open).
  if (slot?.event_id) await callRpc('finish_parse', { p_event: slot.event_id }, supabaseUrl, supabaseAnon, token)
  return json(parsed)
}
