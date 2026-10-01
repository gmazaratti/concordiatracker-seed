import { ACADEMIC_CALENDAR, type AcademicEvent } from '../data/academic-calendar.ts'

/**
 * Which official exam period an undated final falls in.
 *
 * A scanned outline usually says "Final exam: scheduled by the Examinations
 * Office". That is not a date, and we never invent one; but "sometime in the
 * exam period" is real, published information, so an undated final shows it as
 * CONTEXT (never styled like a due date).
 *
 * PURE and Node-tested (exam-period.test.mjs): no React, no clock. The language
 * is a parameter so the formatting can be checked in both.
 */

/** An assessment is a final exam by its kind, or by a title that says so. */
export function isFinalExam(a: { kind: string; title: string }): boolean {
  if (a.kind === 'final') return true
  return /\bfinal\s+(exam|examination)\b|\bexamen\s+final\b/i.test(a.title)
}

const SEASON_PREFIX: Record<string, string> = {
  fall: 'fa',
  automne: 'fa',
  winter: 'wi',
  hiver: 'wi',
  summer: 'su',
  'été': 'su',
  ete: 'su',
}

/** The registrar's finals entry for a term name like "Fall 2026", or null. */
export function examPeriodEvent(
  term: string | null | undefined,
  calendar: AcademicEvent[] = ACADEMIC_CALENDAR,
): AcademicEvent | null {
  const m = (term ?? '').trim().toLowerCase().match(/^([a-zéè]+)\s*[-/ ]?\s*(\d{4})$/)
  if (!m) return null
  const prefix = SEASON_PREFIX[m[1]]
  if (!prefix) return null
  // Summer has two sittings; the full-term one is the one an outline that
  // does not say otherwise is talking about.
  const id = `${prefix}${m[2].slice(2)}-finals`
  return calendar.find((e) => e.id === id && e.kind === 'exam') ?? null
}

/** "Dec 9–22", or "Apr 15 – May 2" across a month boundary. Spaces inside a
 *  date are non-breaking and the dash carries word joiners, so a narrow due
 *  column breaks before the range rather than leaving "22" on its own line. */
export function formatExamPeriod(e: AcademicEvent, lang: 'en' | 'fr' = 'en'): string {
  return rawRange(e, lang).replace(/ (?!\u2013 )/g, '\u00a0').replace(/\u2013(?! )/g, '\u2060\u2013\u2060')
}

function rawRange(e: AcademicEvent, lang: 'en' | 'fr' = 'en'): string {
  const locale = lang === 'fr' ? 'fr-CA' : 'en-US'
  const day = (s: string) => {
    const [y, mo, d] = s.split('-').map(Number)
    return new Date(y, mo - 1, d)
  }
  const a = day(e.start)
  const b = day(e.end ?? e.start)
  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
  const md = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  if (a.getTime() === b.getTime()) return md.format(a)
  if (a.getMonth() === b.getMonth()) {
    return lang === 'fr'
      ? `${a.getDate()}–${b.getDate()} ${month.format(a)}`
      : `${month.format(a)} ${a.getDate()}–${b.getDate()}`
  }
  return `${md.format(a)} – ${md.format(b)}`
}

/**
 * The hint for an undated item, or null. Only finals get one, only without a
 * date, and only when the term has a published exam period.
 */
export function examPeriodHint(
  a: { kind: string; title: string; due: string | null },
  term: string | null | undefined,
  lang: 'en' | 'fr' = 'en',
): string | null {
  if (a.due || !isFinalExam(a)) return null
  const e = examPeriodEvent(term)
  if (!e) return null
  const range = formatExamPeriod(e, lang)
  return lang === 'fr' ? `Période d’examens ${range}` : `Exam period ${range}`
}
