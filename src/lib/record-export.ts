import { sortTermsDesc } from '@/lib/term'

/**
 * Your academic record, as something you can take away.
 *
 * A student needs this in three places the app cannot follow them into: an
 * advising appointment, a scholarship form, and a message to a classmate who
 * asked what you have already taken. So the record has to leave — as a printed
 * sheet, as a spreadsheet, or as plain text pasted anywhere.
 *
 * PURE, so the shaping and both serialisations can be checked in Node. It
 * takes the summary already computed by `summarizeRecord` rather than
 * recomputing a GPA — two places deriving the same number is two places for
 * them to disagree, and a transcript that disagrees with the app is worse than
 * no export at all.
 */
export interface RecordCourse {
  code: string
  title: string
  credits: number
  /** The transcript letter, when there is one. Ungraded courses still count
   *  for credits, so they are listed rather than dropped. */
  letter?: string
}

export interface RecordTerm {
  term: string
  courses: RecordCourse[]
  credits: number
}

export interface RecordSnapshot {
  name: string
  handle?: string
  program?: string
  year?: number | null
  minor?: string | null
  credits: number
  gradedCredits: number
  gpa: number | null
  courseCount: number
  terms: RecordTerm[]
  /** ISO. A record without a date is a claim about now, forever. */
  generatedAt: string
}

export interface PastLike {
  code: string
  title?: string
  credits: number
  term: string
  finalLetter?: string
}

export function buildRecordSnapshot(opts: {
  name: string
  handle?: string
  program?: string
  year?: number | null
  minor?: string | null
  pastCourses: PastLike[]
  summary: { credits: number; gradedCredits: number; gpa: number | null; courseCount: number }
  now?: Date
}): RecordSnapshot {
  const byTerm = new Map<string, RecordCourse[]>()
  for (const c of opts.pastCourses) {
    const term = c.term?.trim() || 'Other'
    const list = byTerm.get(term)
    const row: RecordCourse = {
      code: c.code.trim().toUpperCase(),
      title: c.title?.trim() ?? '',
      credits: c.credits,
      ...(c.finalLetter ? { letter: c.finalLetter } : {}),
    }
    if (list) list.push(row)
    else byTerm.set(term, [row])
  }

  const terms: RecordTerm[] = sortTermsDesc([...byTerm.keys()]).map((term) => {
    const courses = [...(byTerm.get(term) ?? [])].sort((a, b) => a.code.localeCompare(b.code))
    return { term, courses, credits: courses.reduce((n, c) => n + c.credits, 0) }
  })

  return {
    name: opts.name,
    handle: opts.handle,
    program: opts.program,
    year: opts.year ?? null,
    minor: opts.minor ?? null,
    credits: opts.summary.credits,
    gradedCredits: opts.summary.gradedCredits,
    gpa: opts.summary.gpa,
    courseCount: opts.summary.courseCount,
    terms,
    generatedAt: (opts.now ?? new Date()).toISOString(),
  }
}

/** RFC-4180 enough: quote everything, double the quotes inside. A course title
 *  with a comma in it is common and silently splits a naive CSV into the wrong
 *  columns. */
function cell(v: string | number | undefined): string {
  return `"${String(v ?? '').replace(/"/g, '""')}"`
}

export function recordToCsv(s: RecordSnapshot): string {
  const lines = [['Term', 'Code', 'Title', 'Credits', 'Grade'].map(cell).join(',')]
  for (const t of s.terms) {
    for (const c of t.courses) {
      lines.push([t.term, c.code, c.title, c.credits, c.letter ?? ''].map(cell).join(','))
    }
  }
  // A totals row, because the first thing anyone does with this in a
  // spreadsheet is add up the credits column by hand.
  lines.push('')
  lines.push([cell('Total credits'), cell(s.credits)].join(','))
  lines.push([cell('Graded credits'), cell(s.gradedCredits)].join(','))
  lines.push([cell('GPA'), cell(s.gpa === null ? '' : s.gpa.toFixed(2))].join(','))
  return lines.join('\n')
}

export function recordToText(s: RecordSnapshot): string {
  const out: string[] = []
  out.push(s.name)
  const id = [s.handle ? `@${s.handle}` : '', s.program ?? '', s.year ? `Year ${s.year}` : '']
    .filter(Boolean)
    .join(' · ')
  if (id) out.push(id)
  if (s.minor) out.push(`Minor: ${s.minor}`)
  out.push('')
  out.push(
    `${s.credits} credits · ${s.courseCount} courses · GPA ${
      s.gpa === null ? 'not calculated' : `${s.gpa.toFixed(2)} over ${s.gradedCredits} graded credits`
    }`,
  )
  for (const t of s.terms) {
    out.push('')
    out.push(`${t.term}: ${t.credits} credits`)
    for (const c of t.courses) {
      const grade = c.letter ? `  ${c.letter}` : ''
      out.push(`  ${c.code}${c.title ? `, ${c.title}` : ''} (${c.credits})${grade}`)
    }
  }
  out.push('')
  out.push(`Exported from ConcordiaTracker on ${s.generatedAt.slice(0, 10)}`)
  return out.join('\n')
}

/** A filename that is safe everywhere and says what it is without being opened. */
export function recordFilename(s: RecordSnapshot, ext: string): string {
  const who = (s.handle || s.name || 'record').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return `${who}-record-${s.generatedAt.slice(0, 10)}.${ext}`
}
