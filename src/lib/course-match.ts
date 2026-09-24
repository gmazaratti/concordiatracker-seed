import { normalizeTerm, termRank } from '@/lib/term'

/**
 * When two course records are the same course.
 *
 * THE RULE: the same code in the same term is ONE course. Adding it again —
 * from onboarding, the finished-course form, a semester import, a pasted
 * transcript, a syllabus — must land on the record that already exists, never
 * make a second one. A second record is not harmless: credits are summed per
 * record, so one real class read as three courses and ten credits, which is a
 * wrong full-time check, a wrong tuition estimate and a wrong degree audit.
 *
 * The same code in a DIFFERENT term is a retake, which Concordia allows and the
 * GPA already handles (only the latest attempt counts). So that case is worth
 * mentioning and never worth blocking.
 *
 * Pure: no Supabase, no React, so the rule is checked in Node.
 */
export interface CourseLike {
  code: string
  term?: string | null
}

/** "COMP 248", "comp248" and "COMP-248" are one course. Blank stays blank. */
export function courseKey(code: string | null | undefined): string {
  return (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

/** The record this would duplicate: same course, same term. An untitled course
 *  (no code yet) never matches anything — there is nothing to compare. */
export function findSameCourse<T extends CourseLike>(
  all: readonly T[],
  code: string,
  term: string | null | undefined,
): T | undefined {
  const key = courseKey(code)
  if (!key) return undefined
  const t = normalizeTerm(term)
  return all.find((c) => courseKey(c.code) === key && normalizeTerm(c.term) === t)
}

/** Other attempts at the same course in other terms: a retake, shown as a note. */
export function otherAttempts<T extends CourseLike>(
  all: readonly T[],
  code: string,
  term: string | null | undefined,
): T[] {
  const key = courseKey(code)
  if (!key) return []
  const t = normalizeTerm(term)
  return all.filter((c) => courseKey(c.code) === key && normalizeTerm(c.term) !== t)
}

/**
 * The course an uploaded syllabus belongs to, if the student already has it.
 *
 * Matched on the code alone among courses that are NOT finished, because a
 * parsed outline's term is free text that is often missing or phrased oddly —
 * but when the outline does name a term, a course in THAT term wins over one
 * in another. Finished (archived) courses are never a target: an outline is
 * for a class you are taking, and importing it into last year's record would
 * rewrite history.
 */
export function syllabusTarget<T extends CourseLike & { archived?: boolean }>(
  all: readonly T[],
  code: string,
  parsedTerm: string | null | undefined,
): T | undefined {
  const key = courseKey(code)
  if (!key) return undefined
  const live = all.filter((c) => !c.archived && courseKey(c.code) === key)
  if (live.length === 0) return undefined
  const t = normalizeTerm(parsedTerm)
  // A term the outline states outright decides it: a Winter outline does not
  // belong in the Fall class of the same code. Only when the outline names no
  // term we can read does the code alone pick the course.
  if (t && termRank(t) % 10 > 0) return live.find((c) => normalizeTerm(c.term) === t)
  return live[0]
}

/** Several rows about to be added at once (an import): which of them repeat a
 *  row EARLIER in the same batch. Index → true for every repeat. */
export function batchRepeats(codes: readonly string[]): boolean[] {
  const seen = new Set<string>()
  return codes.map((c) => {
    const k = courseKey(c)
    if (!k) return false
    if (seen.has(k)) return true
    seen.add(k)
    return false
  })
}
