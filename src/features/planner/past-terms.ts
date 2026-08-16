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
