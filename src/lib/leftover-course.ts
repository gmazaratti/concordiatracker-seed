/**
 * Is a live (unarchived) course from a finished term really OVER, or a class
 * the student is sitting in right now under the wrong term name?
 *
 * Both look the same from the term string. The second is common and happens
 * at every rollover: a class added in late August is filed under the term
 * that was current that day (Summer), and on September 1 it becomes a
 * "finished" term while the student is attending it. Hiding such a class from
 * This term is the worse mistake (TKT-1034: a paying student's whole Fall
 * schedule vanished into Past semesters), so a course only counts as a
 * leftover on EVIDENCE that it is over:
 *
 *   - it carries a final grade, or
 *   - it has dated work and ALL of it falls before the current term began.
 *
 * No assessments and no grade is not evidence; that course stays where the
 * student can see it. Pure and import-free so Node can test it.
 */
export interface LeftoverInput {
  finalPercent?: number | null
  finalLetter?: string | null
  /** ISO due dates of the course's assessments; null/empty = undated. */
  dues: (string | null | undefined)[]
}

/** First day of the term containing `now` (Winter Jan, Summer May, Fall Sep). */
export function currentTermStart(now: Date): Date {
  const m = now.getMonth()
  const startMonth = m <= 3 ? 0 : m <= 7 ? 4 : 8
  return new Date(now.getFullYear(), startMonth, 1)
}

export function looksFinished(c: LeftoverInput, now: Date): boolean {
  if (c.finalPercent != null || (c.finalLetter ?? '').trim()) return true
  const start = currentTermStart(now).getTime()
  const dated = c.dues
    .filter((d): d is string => !!d)
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
  return dated.length > 0 && dated.every((t) => t < start)
}
