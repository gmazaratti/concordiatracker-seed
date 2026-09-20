/**
 * The syllabus extractor itself — the prompt, the schema, and the one call to
 * the model. Shared by the web upload (`api/parse-syllabus.ts`) and the
 * personal API (`POST /api/v1/me/courses/from-outline`).
 *
 * WHY IT MOVED OUT OF THE HANDLER. Two callers wanting the same extraction is
 * exactly how a second, slightly-different prompt gets written, and then a
 * student's outline parses one way through the website and another way
 * through an assistant. This file has no auth, no rate limiting and no HTTP
 * in it; those are the caller's, and they genuinely differ (a browser session
 * versus an API token). The extraction does not.
 *
 * The Google key lives only on the server, never VITE_-prefixed, so it cannot
 * reach the browser bundle.
 */
import { pdfText } from './_econcordia.js'

export const GEMINI_MODEL = 'gemini-2.5-flash'
export const MAX_BYTES = 4 * 1024 * 1024 // 4 MB — syllabi are tiny

/**
 * Abort the model before the platform aborts us, so the error is ours to word.
 *
 * 23s, under the Edge runtime's 25s ceiling. It was 20s, and that was the
 * whole of one paying student's "it says my outline is too long": three
 * timeouts in his log, one on 5,969 characters — while a 17,466 character
 * outline measured 8.1s and came back fine. Length was never the variable.
 * Thinking tokens were, which is what `thinkingBudget: 0` removes.
 */
export const MODEL_TIMEOUT_MS = 23_000

/**
 * Below this, the extracted "text" is a header and a link table, not a
 * syllabus.
 *
 * MEASURED, not guessed. Across the 45 real Concordia outlines cached from
 * the eConcordia scrape, the three our extractor cannot read come out at 114,
 * 532 and 544 characters; the thinnest it CAN read is 4,410 and the median is
 * 14,539. There is nothing at all between 550 and 4,400, so the line sits in
 * that gap with room either side. The old 400 sat just BELOW the junk, which
 * is how a document yielding 630 characters of link table took the text path,
 * found no assessments, and returned an empty result with no reason.
 */
export const MIN_TEXT_CHARS = 1_500

export const PROMPT = `You are an expert at reading university course syllabi and extracting the graded assessment schedule. You will receive a course syllabus as a PDF. Extract the course identity and EVERY graded assessment into the exact JSON schema provided.

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

export const SCHEMA = {
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

export interface ParsedAssessment {
  title: string
  kind: string
  due: string | null
  weight: number | null
  description: string
}

export interface ParsedCourse {
  code?: string
  title?: string
  term?: string
  section?: string
  instructorName?: string
  instructorEmail?: string
  taName?: string
  taEmail?: string
  gradingScale?: string
}

/**
 * WHAT WENT WRONG, as a value the caller can branch on.
 *
 * Not a message: the web upload answers a student mid-flow and the API
 * answers a program, and those want different words and different status
 * codes for the same event. Flattening it to one string here would have
 * forced one of them to be wrong — and the message that said "try a shorter
 * PDF" for what was actually our timeout is precisely that mistake, already
 * made once.
 */
export type ParseFailure =
  | 'not_configured'
  | 'timeout'
  | 'unreachable'
  | 'upstream'
  | 'unreadable'

export interface ParseResult {
  ok: boolean
  course: ParsedCourse
  assessments: ParsedAssessment[]
  /** Which path ran, for the failure record: `text:33343ch` or `pdf:478878b`. */
  how: string
  failure?: ParseFailure
  /** The model's HTTP status, when it answered and the answer was a refusal. */
  upstreamStatus?: number
  /** A short technical line for the failure record — never shown to a person. */
  detail?: string
  /** True when the model was asked twice — text first, then the document. */
  retried?: boolean
}

export function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

/** One call to the model, bounded on our side. */
async function ask(apiKey: string, parts: unknown[], budgetMs: number): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(budgetMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA,
          /**
           * NO THINKING. 2.5-flash reasons before it answers unless told not
           * to, and that reasoning is most of the wall clock here — enough to
           * push a two-page outline past the timeout while a six-page one
           * squeaked under. Nothing is lost: the output is pinned to a JSON
           * schema and the task is transcription, not deduction.
           */
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  )
}

function readModelJson(raw: string): { course: ParsedCourse; assessments: ParsedAssessment[] } | null {
  try {
    const body = JSON.parse(raw) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    }
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) return null
    const parsed = JSON.parse(text) as { course?: ParsedCourse; assessments?: ParsedAssessment[] }
    return { course: parsed.course ?? {}, assessments: parsed.assessments ?? [] }
  } catch {
    return null
  }
}

/**
 * Extract a syllabus.
 *
 * TEXT FIRST, PIXELS SECOND. Handing the model a raw PDF makes it do the
 * document parsing as well as the extraction, and on a long syllabus that
 * alone outruns the ceiling — we already own a text extractor, it is pure
 * string work, and it costs no model time. The PDF stays the fallback,
 * because a scan has no text layer and only the model can read it.
 *
 * And if the text path comes back with NOTHING, the document itself gets one
 * more go with whatever budget is left: a zero-assessment result is the same
 * thing an unreadable file produces, and spending a second call to tell them
 * apart is worth it. PHIL 235, which an earlier session wrote off as
 * unreadable, went from 0 items to 4 that way.
 */
export async function extractOutline(buf: ArrayBuffer, mimeType: string): Promise<ParseResult> {
  const apiKey = process.env.GEMINI_API_KEY
  const empty = { course: {}, assessments: [] as ParsedAssessment[] }
  if (!apiKey) {
    return { ok: false, ...empty, how: 'none', failure: 'not_configured' }
  }

  let extracted = ''
  try {
    extracted = (await pdfText(new Uint8Array(buf))).trim()
  } catch {
    extracted = '' // an unreadable structure is not an error, it is the fallback
  }

  const useText = extracted.length >= MIN_TEXT_CHARS
  const how = useText ? `text:${extracted.length}ch` : `pdf:${buf.byteLength}b`
  const textParts = [{ text: `${PROMPT}\n\n--- SYLLABUS TEXT ---\n${extracted.slice(0, 120_000)}` }]
  const pdfParts = [{ inlineData: { mimeType, data: toBase64(buf) } }, { text: PROMPT }]

  const started = Date.now()
  let res: Response
  try {
    res = await ask(apiKey, useText ? textParts : pdfParts, MODEL_TIMEOUT_MS)
  } catch (err) {
    const timedOut = (err as Error)?.name === 'TimeoutError'
    return {
      ok: false,
      ...empty,
      how,
      failure: timedOut ? 'timeout' : 'unreachable',
      detail: timedOut
        ? `model timeout after ${MODEL_TIMEOUT_MS}ms (${how})`
        : `fetch failed (${how}): ${(err as Error)?.message ?? 'unknown'}`,
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    // Logged here too: what a student is shown has to be short, and what we
    // debug with does not.
    console.error('[parse] model', res.status, body.slice(0, 400))
    return {
      ok: false,
      ...empty,
      how,
      failure: 'upstream',
      upstreamStatus: res.status,
      detail: `model ${res.status} (${useText ? 'text' : 'pdf'}): ${body.slice(0, 200)}`,
    }
  }

  const raw = await res.text()
  const first = readModelJson(raw)
  if (!first) {
    return {
      ok: false,
      ...empty,
      how,
      failure: 'unreadable',
      detail: `model returned nothing usable: ${raw.slice(0, 200)}`,
    }
  }

  if (first.assessments.length > 0 || !useText) {
    return { ok: true, course: first.course, assessments: first.assessments, how }
  }

  // Nothing found in the text. Spend what is left of the budget on the file.
  const left = MODEL_TIMEOUT_MS - (Date.now() - started)
  if (left < 4_000) {
    return { ok: true, course: first.course, assessments: [], how }
  }
  try {
    const second = await ask(apiKey, pdfParts, left)
    const again = second.ok ? readModelJson(await second.text()) : null
    if (again) {
      return {
        ok: true,
        course: again.course.code ? again.course : first.course,
        assessments: again.assessments,
        how: `${how}+pdf`,
        retried: true,
      }
    }
  } catch {
    /* the first answer stands */
  }
  return { ok: true, course: first.course, assessments: [], how, retried: true }
}
