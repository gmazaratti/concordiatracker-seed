/**
 * Summing up a finished record.
 *
 * PURE — no Supabase import — because `summarizeRecord` decides the credits
 * and the GPA denominator on someone's profile, and that has to be checkable
 * in Node. It lived next to the profile loaders, which pull in the Supabase
 * client, and a module that reaches for `import.meta.env` cannot be tested.
 * The third time this pattern bit in one day.
 */
import type { Course } from '@/data/types'
import { currentGpa, percentToGrade, supersededCourseIds } from '@/lib/gpa'

/** "COMP 248" → "COMP". Null when the code isn't shaped like one. */
export function subjectOf(code: string): string | null {
  const m = code.trim().toUpperCase().match(/^([A-Z]{2,6})/)
  return m ? m[1] : null
}

export interface RecordSummary {
  /** Credits from finished courses, graded or not. */
  credits: number
  /** Credits that actually carry a grade, so the GPA line can say what it covers. */
  gradedCredits: number
  gpa: number | null
  courseCount: number
  /** Distinct subjects seen, most-taken first — the basis for what to scan. */
  subjects: string[]
  /** Normalised codes of everything finished. */
  completedCodes: string[]
}

/**
 * Summarise finished courses.
 *
 * Credits count every completed course; the GPA counts only graded ones, and
 * `gradedCredits` exists so the UI can say which is which instead of quietly
 * showing a GPA over a third of someone's degree as though it covered all of it.
 */
export function summarizeRecord(pastCourses: Course[], assessments: Parameters<typeof currentGpa>[1]): RecordSummary {
  let credits = 0
  let gradedCredits = 0
  const subjectCount = new Map<string, number>()
  const completedCodes: string[] = []

  /**
   * A REPEATED COURSE IS NOT TWO COURSES, AND A FAIL EARNS NOTHING.
   *
   * This used to add `c.credits` for every archived row, which meant a student
   * who failed COMM 226 and retook it was shown 60 credits for 57 credits of
   * work — and told their GPA was "over 60 graded credits" when `currentGpa`
   * had already, correctly, computed it over 57. The app disagreed with itself
   * on its own profile page, and the bigger number was the wrong one.
   *
   * `supersededCourseIds` is the same helper the GPA uses, implementing
   * Concordia's rule that only the latest attempt counts. Reusing it rather
   * than re-deriving "which attempt wins" is the point: two answers to that
   * question is how the two numbers drifted apart in the first place.
   */
  const superseded = supersededCourseIds(pastCourses, assessments)

  for (const c of pastCourses) {
    // Still LISTED — it happened, and a transcript that hides it is lying —
    // but it no longer counts toward credits, graded credits or the GPA.
    if (superseded.has(c.id)) continue

    const graded = typeof c.finalPercent === 'number'
    // Credits are credits EARNED. A fail earns none, whether or not it was
    // ever retaken; the F still shows on the record with its 0 grade points.
    if (!graded || percentToGrade(c.finalPercent as number).points > 0) {
      credits += c.credits
    }
    if (graded) gradedCredits += c.credits

    const subject = subjectOf(c.code)
    if (subject) subjectCount.set(subject, (subjectCount.get(subject) ?? 0) + 1)
    if (c.code.trim()) completedCodes.push(c.code.trim().toUpperCase())
  }

  return {
    credits,
    gradedCredits,
    gpa: currentGpa(pastCourses, assessments),
    courseCount: pastCourses.length,
    subjects: [...subjectCount.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s),
    completedCodes,
  }
}
