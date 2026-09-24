import { supabase } from './supabase'
import type { AssessmentKind } from '@/data/types'

/** Raw shape returned by the /api/parse-syllabus function (the Gemini output). */
export interface ParsedAssessment {
  title: string
  kind: string
  /** ISO date/datetime, or null if the syllabus didn't give one. */
  due: string | null
  /** Percent of final grade (0–100), or null if not stated. */
  weight: number | null
  description: string
  /** Graded with no date at all (attendance, participation). Absent from an
   *  older server; treat as false. */
  noDateNeeded?: boolean
}

export interface ParsedSyllabus {
  course: {
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
  assessments: ParsedAssessment[]
  /** Things the server wants the student to check (an impossible weight total). */
  warnings?: string[]
}

const KINDS: AssessmentKind[] = ['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project']

/** Defensive: the schema constrains kind to the enum, but coerce anything off to a safe default. */
export function normalizeKind(kind: string): AssessmentKind {
  const k = kind.trim().toLowerCase()
  return (KINDS as string[]).includes(k) ? (k as AssessmentKind) : 'assignment'
}

/** What a failure means when the server gave us nothing but a status code. */
function statusMessage(status: number): string {
  if (status === 404) return 'The parser only runs on the deployed site, not local dev.'
  if (status === 413) return 'That file is too large — the limit is 4 MB.'
  if (status === 504 || status === 502)
    return 'The parser ran out of time on that file. That is our ceiling, not your outline — try again, and tell support if it keeps happening.'
  if (status >= 500) return `The parser errored (${status}). Try again in a moment.`
  return `That upload was rejected (${status}).`
}

/**
 * Upload a syllabus PDF to the server function and get back structured data.
 * The Supabase access token is attached so the function can confirm the caller
 * is signed in. The PDF is sent as the raw body (no base64 inflation on the wire).
 * Throws an Error with a user-friendly message on any failure.
 */
export async function parseSyllabusPdf(file: File): Promise<ParsedSyllabus> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Please sign in again to parse a syllabus.')

  let res: Response
  try {
    res = await fetch('/api/parse-syllabus', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'application/pdf',
        // A label for the admin record of this parse; the server never uses it as a path.
        'x-file-name': encodeURIComponent(file.name.slice(0, 200)),
      },
      body: file,
    })
  } catch {
    throw new Error('Couldn’t reach the parser. Check your connection and try again.')
  }

  if (!res.ok) {
    // A JSON body means the function itself answered and knows what went wrong.
    // No JSON means something ABOVE the function answered — a gateway timeout,
    // a platform error page — and the old code showed "Something went wrong"
    // for all of it. That is the "it failed and didn't say why" report: the
    // status is the only fact available, so say what it means.
    let msg = ''
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) msg = body.error
    } catch {
      msg = ''
    }
    throw new Error(msg || statusMessage(res.status))
  }

  return (await res.json()) as ParsedSyllabus
}

export interface ParseUsage {
  /** Successful parses this calendar month. */
  used: number
  limit: number
  /** ISO start of next month (when `used` resets). */
  resetsAt: string
  /** True on a paid plan, where there is no monthly cap at all. */
  unlimited: boolean
  /** ISO instant the per-upload cooldown ends, or null if not cooling down. */
  cooldownUntil: string | null
}

/** The signed-in user's parse usage (for the upload screen + Settings → Usage).
 * Reads the get_parse_usage RPC; the limits themselves are enforced server-side. */
export async function getParseUsage(): Promise<ParseUsage | null> {
  const { data, error } = await supabase.rpc('get_parse_usage')
  if (error || !data) return null
  const d = data as {
    used: number
    // null on a paid plan: no cap. `?? 5` would turn that into the free
    // allowance, which is the bug this pair of fields exists to stop.
    limit: number | null
    pro?: boolean
    cooldown: number
    resets_at: string
    last_at: string | null
  }
  const unlimited = d.limit === null || d.pro === true
  let cooldownUntil: string | null = null
  if (d.last_at) {
    const until = new Date(new Date(d.last_at).getTime() + (d.cooldown ?? 180) * 1000)
    if (until.getTime() > Date.now()) cooldownUntil = until.toISOString()
  }
  return {
    used: d.used ?? 0,
    limit: unlimited ? Infinity : (d.limit ?? 5),
    unlimited,
    resetsAt: d.resets_at,
    cooldownUntil,
  }
}

/**
 * The result of an admin re-running a parse that failed for this student
 * (db/parse_tracking.sql → my_parse_retry). Null when there is none, or it is
 * not theirs — the function only returns the caller's own.
 */
export async function loadParseRetry(eventId: string): Promise<ParsedSyllabus | null> {
  const { data, error } = await supabase.rpc('my_parse_retry', { p_event: eventId })
  if (error || !data) return null
  const r = data as Partial<ParsedSyllabus>
  if (!r.course || !Array.isArray(r.assessments)) return null
  return r as ParsedSyllabus
}
