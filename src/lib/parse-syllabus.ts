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
}

const KINDS: AssessmentKind[] = ['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project']

/** Defensive: the schema constrains kind to the enum, but coerce anything off to a safe default. */
export function normalizeKind(kind: string): AssessmentKind {
  const k = kind.trim().toLowerCase()
  return (KINDS as string[]).includes(k) ? (k as AssessmentKind) : 'assignment'
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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type || 'application/pdf' },
      body: file,
    })
  } catch {
    throw new Error('Couldn’t reach the parser. Check your connection and try again.')
  }

  if (!res.ok) {
    let msg = 'Something went wrong reading that file.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) msg = body.error
    } catch {
      if (res.status === 404) msg = 'The parser only runs on the deployed site, not local dev.'
    }
    throw new Error(msg)
  }

  return (await res.json()) as ParsedSyllabus
}
