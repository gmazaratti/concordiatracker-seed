import { parseCourseCode, sectionKeys, termCodeFor } from './course-sections.ts'

/**
 * Which registrar deadlines apply to a student's course.
 *
 * The rows come from `section_deadlines` (db/section_deadlines.sql), mirrored
 * daily from the registrar's term-dates page. A course follows its section's
 * own row when the registrar lists one (a "non-standard" section) and the
 * term's standard row otherwise.
 *
 * NEVER GUESSES A SECTION. When the course has no section on record and the
 * registrar lists some sections of that course with their own dates, we do not
 * know which set applies, so the answer says so (`needsSection`) instead of
 * quietly showing the standard dates. A wrong DNE date is a lost refund.
 *
 * PURE: no network, no React. Tested in section-deadlines.test.mjs.
 */

export interface DeadlineRecord {
  term_code: string
  kind: 'standard' | 'section'
  subject: string
  catalog: string
  section: string
  session: string
  section_prefixes: string[] | null
  start_date: string | null
  end_date: string | null
  registration: string | null
  dne: string | null
  disc: string | null
}

export type CourseDeadlines =
  /** The registrar lists this exact section with its own dates. */
  | { kind: 'section'; row: DeadlineRecord }
  /** An ordinary section: the term's standard dates. */
  | { kind: 'standard'; row: DeadlineRecord }
  /** Some sections of this course have their own dates, and we do not know
   *  which section the student is in. */
  | { kind: 'needsSection'; termCode: string }

/**
 * Term codes a course filed under `term` can belong to. A year-long course
 * (Fall/Winter, digit 3) is usually filed under its Fall or its Winter half,
 * so both look at the year-long code too.
 */
export function candidateTerms(term: string): string[] {
  const code = termCodeFor(term)
  if (!code) return []
  const season = code[3]
  if (season === '2' || season === '4') return [code, `${code.slice(0, 3)}3`]
  return [code]
}

export function deadlinesForCourse(
  course: { code: string; section?: string | null; term: string },
  rows: DeadlineRecord[],
): CourseDeadlines | null {
  const parsed = parseCourseCode(course.code)
  const terms = candidateTerms(course.term)
  if (!parsed || terms.length === 0) return null
  const keys = sectionKeys(course.section ?? '')

  const own = rows.filter(
    (r) => r.kind === 'section' && terms.includes(r.term_code) && r.subject === parsed.subject && r.catalog === parsed.catalog,
  )
  if (keys.length > 0) {
    const hit = own.find((r) => keys.includes(r.section.toUpperCase()))
    if (hit) return { kind: 'section', row: hit }
  } else if (own.length > 0) {
    return { kind: 'needsSection', termCode: terms[0] }
  }

  const standard = rows.filter((r) => r.kind === 'standard' && r.term_code === terms[0])
  if (standard.length === 1) return { kind: 'standard', row: standard[0] }
  if (standard.length > 1) {
    // Summer: three sessions, chosen by how the section label begins. "EC"
    // is listed under all three, so it cannot decide anything and is skipped.
    for (const key of keys) {
      const matches = standard.filter((r) =>
        (r.section_prefixes ?? []).some((p) => p !== 'EC' && key.startsWith(p)),
      )
      if (matches.length === 1) return { kind: 'standard', row: matches[0] }
    }
    return { kind: 'needsSection', termCode: terms[0] }
  }
  return null
}

/** The three dates worth naming, in the order they fall, with the ones a
 *  student cannot act on any more filtered out by the caller. */
export function deadlineList(row: DeadlineRecord): { key: 'registration' | 'dne' | 'disc'; date: string }[] {
  const out: { key: 'registration' | 'dne' | 'disc'; date: string }[] = []
  // Registration and DNE are usually the same day; one line says both.
  if (row.registration && row.registration !== row.dne) out.push({ key: 'registration', date: row.registration })
  if (row.dne) out.push({ key: 'dne', date: row.dne })
  if (row.disc) out.push({ key: 'disc', date: row.disc })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

const SHORT = { registration: 'last day to add', dne: 'last day to drop for a refund (DNE)', disc: 'last day to withdraw (DISC)' } as const

/**
 * Calendar entries for the courses whose SECTION has its own dates. Standard
 * dates are not repeated per course: the academic calendar already carries the
 * term-wide ones, and five identical "DNE" chips on one day would read as five
 * deadlines. Finished courses are skipped.
 */
export function sectionDeadlineEvents(
  courses: { id: string; code: string; section?: string | null; term: string; archived?: boolean }[],
  rows: DeadlineRecord[],
): { id: string; title: string; start: string; kind: 'deadline' }[] {
  const out: { id: string; title: string; start: string; kind: 'deadline' }[] = []
  for (const c of courses) {
    if (c.archived || !c.term) continue
    const match = deadlinesForCourse(c, rows)
    if (match?.kind !== 'section') continue
    for (const d of deadlineList(match.row)) {
      const what = d.key === 'dne' && match.row.registration === match.row.dne ? 'last day to add or drop for a refund (DNE)' : SHORT[d.key]
      out.push({ id: `dl-${c.id}-${d.key}`, title: `${c.code}: ${what}`, start: d.date, kind: 'deadline' })
    }
  }
  return out
}
