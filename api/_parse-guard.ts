/**
 * What stands between an uploaded syllabus and the rest of the product.
 *
 * PURE — no imports, no network — so every rule here is checked in Node
 * (`api/_parse-guard.test.mjs`). Two jobs:
 *
 *  1. Decide whether the text we pulled out of a PDF is really text.
 *  2. Treat whatever the model returns as UNTRUSTED INPUT. A syllabus is a
 *     document someone else wrote, and a crafted one can steer a model into
 *     returning anything its schema allows. So nothing leaves the server that
 *     has not been narrowed to exactly the shape the app renders: capped
 *     strings with control characters removed, a kind from the fixed list, a
 *     weight from 0 to 100, a real calendar date or null.
 */

/**
 * How much of the extracted text is WORDS.
 *
 * Length alone was the test, and it passed garbage: some PDFs subset their
 * fonts so glyphs do not map back to letters, and the extractor produces
 * thousands of characters like "8H-.A!,0+". Measured across the 45 cached
 * Concordia outlines plus the RELI 230 syllabus a student uploaded: the three
 * garbled files score 0.001, 0.009 and 0.010; the lowest readable one scores
 * 0.654. The line sits in that gap. Below it, the model reads the PDF itself.
 */
export const MIN_WORD_RATIO = 0.3

export function wordRatio(text: string): number {
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  const words = tokens.filter(
    (w) => /^[A-Za-zÀ-ÿ'’-]{2,}[.,;:!?)]?$/.test(w) && /[aeiouyàâéèêëîïôûùAEIOUY]/i.test(w),
  ).length
  return words / tokens.length
}

export function textIsReadable(text: string, minChars: number): boolean {
  return text.length >= minChars && wordRatio(text) >= MIN_WORD_RATIO
}

/**
 * PDF only, by its first bytes. The Content-Type header is whatever the
 * client sends, and it used to be passed straight to the model as the file's
 * type — so anything could be labelled a PDF. The magic number cannot be.
 */
export function isPdf(bytes: Uint8Array): boolean {
  // "%PDF-" may be preceded by a little junk; the spec tolerates 1 KB of it.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024))
  return head.includes('%PDF-')
}

/** Page objects in a PDF. An estimate — a compressed object stream hides them,
 *  which yields 0 and is treated as "unknown", not as "fine". */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes)
  return (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length
}

export const MAX_PAGES = 40
export const MAX_ITEMS = 60
export const KINDS = ['assignment', 'quiz', 'midterm', 'final', 'lab', 'reading', 'project'] as const

export interface CleanAssessment {
  title: string
  kind: (typeof KINDS)[number]
  due: string | null
  weight: number | null
  description: string
  /** Graded without ever being due on a date: attendance, participation. */
  noDateNeeded: boolean
}

export interface CleanCourse {
  code: string
  title: string
  term: string
  section: string
  instructorName: string
  instructorEmail: string
  taName: string
  taEmail: string
  gradingScale: string
}

/** Control characters and bidi overrides out, whitespace collapsed, capped. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

function cleanEmail(value: unknown): string {
  const v = cleanText(value, 120)
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? v : ''
}

/** A real calendar date (optionally with a time), or null. "2026-02-30" is not one. */
export function cleanDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.exec(
    value.trim(),
  )
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (y < 2000 || y > 2100) return null
  const probe = new Date(Date.UTC(y, mo - 1, d))
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null
  return value.trim()
}

export function cleanWeight(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  if (!Number.isFinite(n) || n < 0 || n > 100) return null
  return Math.round(n * 100) / 100
}

/**
 * Narrow the model's answer to what the app accepts. Also reports anything
 * worth telling the student — a weight total that cannot be right — rather
 * than silently "fixing" numbers they will read against the syllabus.
 */
export function cleanParse(raw: { course?: unknown; assessments?: unknown }): {
  course: CleanCourse
  assessments: CleanAssessment[]
  warnings: string[]
} {
  const c = (raw.course && typeof raw.course === 'object' ? raw.course : {}) as Record<string, unknown>
  const course: CleanCourse = {
    code: cleanText(c.code, 20),
    title: cleanText(c.title, 150),
    term: cleanText(c.term, 30),
    section: cleanText(c.section, 20),
    instructorName: cleanText(c.instructorName, 100),
    instructorEmail: cleanEmail(c.instructorEmail),
    taName: cleanText(c.taName, 100),
    taEmail: cleanEmail(c.taEmail),
    gradingScale: cleanText(c.gradingScale, 300),
  }

  const list = Array.isArray(raw.assessments) ? raw.assessments : []
  const assessments: CleanAssessment[] = list.slice(0, MAX_ITEMS).flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const a = item as Record<string, unknown>
    const title = cleanText(a.title, 150)
    if (!title) return []
    const kind = (KINDS as readonly string[]).includes(a.kind as string)
      ? (a.kind as CleanAssessment['kind'])
      : 'assignment'
    const noDateNeeded = a.noDateNeeded === true
    return [
      {
        title,
        kind,
        due: noDateNeeded ? null : cleanDate(a.due),
        weight: cleanWeight(a.weight),
        description: cleanText(a.description, 400),
        noDateNeeded,
      },
    ]
  })

  const warnings: string[] = []
  const total = assessments.reduce((s, a) => s + (a.weight ?? 0), 0)
  if (total > 150) {
    warnings.push(
      `The weights found add up to ${Math.round(total)}%. Check them against the syllabus before adding.`,
    )
  }
  if (list.length > MAX_ITEMS) {
    warnings.push(`Only the first ${MAX_ITEMS} assessments were kept.`)
  }
  return { course, assessments, warnings }
}
