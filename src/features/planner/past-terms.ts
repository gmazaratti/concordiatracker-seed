import { termRank } from '@/lib/term'

/**
 * Term names for entering past courses.
 *
 * Concordia runs Winter, Summer and Fall, in that calendar order within a year.
 * Pure, and separate from the component so it can be checked without rendering.
 */
export function pastTerms(count = 18, now = new Date()): string[] {
  const out: string[] = []
  for (let y = now.getFullYear(); out.length < count; y--) {
    // Newest first within the year, so the list reads backwards through time.
    for (const s of ['Fall', 'Summer', 'Winter']) out.push(`${s} ${y}`)
  }
  return out.slice(0, count)
}

/** Years of study offered. "Graduate" is last because it is a different thing,
 *  not a fifth undergraduate year. */
export const YEARS: { value: number; label: string }[] = [
  { value: 1, label: 'Year 1' },
  { value: 2, label: 'Year 2' },
  { value: 3, label: 'Year 3' },
  { value: 4, label: 'Year 4' },
  { value: 5, label: 'Year 5 or beyond' },
  { value: 9, label: 'Graduate' },
]

/**
 * Terms ahead of now, for saying when you intend to take something.
 *
 * The opposite direction from pastTerms: a shortlist is about the future, and
 * offering "Fall 2023" as a plan would be nonsense.
 */
export function futureTerms(count = 9, now = new Date()): string[] {
  const out: string[] = []
  for (let y = now.getFullYear(); out.length < count; y++) {
    for (const s of ['Winter', 'Summer', 'Fall']) out.push(`${s} ${y}`)
  }
  return out.slice(0, count)
}

/**
 * The term we are in right now, from the calendar.
 *
 * Concordia runs Winter (January to April), Summer (May to August) and Fall
 * (September to December). Derived rather than configured, so it cannot go
 * stale the way a hard-coded "current term" does.
 */
export function currentTermName(now = new Date()): string {
  const m = now.getMonth()
  const season = m <= 3 ? 'Winter' : m <= 7 ? 'Summer' : 'Fall'
  return `${season} ${now.getFullYear()}`
}

/**
 * Is this term the current one or a later one?
 *
 * The distinction decides whether a course is HISTORY or a PLAN: entering
 * "Fall 2026" in the summer means classes you are about to take, and filing
 * those away as a finished term would put them on your transcript with no
 * grade and hide them from the term you are about to run.
 */
export function isUpcomingTerm(term: string, now = new Date()): boolean {
  return termRank(term) >= termRank(currentTermName(now))
}

/**
 * Every term worth offering, future first, then back through the past.
 *
 * One list rather than two, because a student registering in July is entering
 * next term and last term in the same sitting, and making them find a different
 * control for each is the kind of thing that gets a feature abandoned.
 */
export function allTerms(back = 15, ahead = 4, now = new Date()): string[] {
  const future = futureTerms(ahead + 3, now).filter((t) => isUpcomingTerm(t, now))
  const past = pastTerms(back, now).filter((t) => !isUpcomingTerm(t, now))
  return [...future.slice(0, ahead), ...past]
}
