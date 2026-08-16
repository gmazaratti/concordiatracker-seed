import type { Assessment, AssessmentKind, Course } from '@/data/types'
import { gradeToPercent } from './grade'
import { termRank } from './term'

/** Concordia's 4.30 letter scale. Percentage cutoffs follow the common
 * undergraduate mapping (departments vary slightly — fine for a demo). */
interface GradeBand {
  min: number
  letter: string
  points: number
}

const GRADE_SCALE: GradeBand[] = [
  { min: 90, letter: 'A+', points: 4.3 },
  { min: 85, letter: 'A', points: 4.0 },
  { min: 80, letter: 'A-', points: 3.7 },
  { min: 77, letter: 'B+', points: 3.3 },
  { min: 73, letter: 'B', points: 3.0 },
  { min: 70, letter: 'B-', points: 2.7 },
  { min: 67, letter: 'C+', points: 2.3 },
  { min: 63, letter: 'C', points: 2.0 },
  { min: 60, letter: 'C-', points: 1.7 },
  { min: 57, letter: 'D+', points: 1.3 },
  { min: 53, letter: 'D', points: 1.0 },
  { min: 50, letter: 'D-', points: 0.7 },
  { min: 0, letter: 'F', points: 0.0 },
]

/**
 * Notations that carry grade points but are not on the percentage scale.
 *
 * FNS is "fail, no supplemental": a fail that cannot be redeemed by a
 * supplemental exam. It is worth the same 0.00 as F and counts in the GPA
 * identically, so a student rebuilding a transcript needs to be able to enter
 * exactly what it says rather than translating it to F themselves.
 *
 * R (repeat) and NR (no record) are also 0.00 at Concordia. DNW (did not write)
 * appears attached to another notation rather than alone.
 */
const NOTATIONS: { letter: string; points: number }[] = [
  { letter: 'FNS', points: 0.0 },
  { letter: 'R', points: 0.0 },
  { letter: 'NR', points: 0.0 },
]

/**
 * A letter grade back to a percentage.
 *
 * Transcripts show letters, so that is what a student rebuilding their history
 * has in front of them, and making them convert by hand invites errors. The
 * band's MINIMUM is used rather than its midpoint: it is the only number the
 * letter actually guarantees, and inventing a midpoint would quietly inflate a
 * GPA the student never earned.
 *
 * Returns null for anything that is not a grade on this scale, so a typo lands
 * as "not entered" rather than as an F.
 */
export function letterToPercent(raw: string): number | null {
  const key = raw.trim().toUpperCase().replace(/\s+/g, '')
  const band = GRADE_SCALE.find((b) => b.letter === key)
  if (band) return band.min
  // A notation has no percentage of its own; 0 is the honest stand-in, since
  // every notation we accept is worth 0.00 grade points.
  return NOTATIONS.some((n) => n.letter === key) ? 0 : null
}

/** True when the text is a notation rather than a letter on the scale. */
export function isNotation(raw: string): boolean {
  const key = raw.trim().toUpperCase().replace(/\s+/g, '')
  return NOTATIONS.some((n) => n.letter === key)
}

/** Every letter on the scale, best first, for a picker. */
export const GRADE_LETTERS: string[] = [
  ...GRADE_SCALE.map((b) => b.letter),
  ...NOTATIONS.map((n) => n.letter),
]

/**
 * Read a grade the student typed, as either a percentage or a letter.
 *
 * "87" and "A" are both valid answers to "what did you get", and which one a
 * person reaches for depends on which document they are looking at.
 */
export function parseFinalGrade(raw: string): number | null {
  const text = raw.trim()
  if (!text) return null
  const n = Number(text.replace(/%$/, ''))
  if (!Number.isNaN(n)) return n >= 0 && n <= 100 ? n : null
  return letterToPercent(text)
}

export function percentToGrade(percent: number): { letter: string; points: number } {
  const band = GRADE_SCALE.find((b) => percent >= b.min) ?? GRADE_SCALE.at(-1)!
  return { letter: band.letter, points: band.points }
}

/** Letter targets a student can aim for (drops F — you don't aim to fail). */
export const GRADE_TARGETS: { letter: string; min: number }[] = GRADE_SCALE.filter(
  (b) => b.points > 0,
).map((b) => ({ letter: b.letter, min: b.min }))

/** One weighted term in a course grade: a category (assessment kind), the weight
 * points it contributes so far, and its average score. A course's grade is the
 * weighted average of these terms. */
export interface GradeTerm {
  kind: AssessmentKind
  /** Graded weight this category contributes (grade-percent points). */
  weight: number
  /** The category's weighted-average score. */
  percent: number
}

/** The graded categories behind a course's current grade. THE single source of
 * truth for the weighted average: both `coursePercent` (which drives the header
 * grade + GPA) and the "How is this calculated?" panel read from this, so the
 * shown formula can never drift from the computed result. */
export function gradeTerms(assessments: Assessment[]): GradeTerm[] {
  const byKind = new Map<AssessmentKind, { weight: number; points: number }>()
  for (const a of assessments) {
    const percent = gradeToPercent(a.grade)
    if (percent === null) continue
    const acc = byKind.get(a.kind) ?? { weight: 0, points: 0 }
    acc.weight += a.weight
    acc.points += (percent * a.weight) / 100
    byKind.set(a.kind, acc)
  }
  return [...byKind.entries()]
    .map(([kind, v]) => ({ kind, weight: v.weight, percent: (v.points / v.weight) * 100 }))
    .sort((a, b) => b.weight - a.weight)
}

/** Weighted average of grade terms: Σ(weightᵢ · percentᵢ) ÷ Σ(weightᵢ).
 * Null when nothing is graded. */
export function weightedAverage(terms: GradeTerm[]): number | null {
  const totalWeight = terms.reduce((sum, t) => sum + t.weight, 0)
  if (totalWeight === 0) return null
  const earned = terms.reduce((sum, t) => sum + t.weight * t.percent, 0)
  return earned / totalWeight
}

/** Weighted percentage across a course's graded assessments, normalized by the
 * weight graded so far. Null when nothing is graded yet. Delegates to the shared
 * `gradeTerms` / `weightedAverage` definition (so display + calc never drift). */
export function coursePercent(assessments: Assessment[]): number | null {
  return weightedAverage(gradeTerms(assessments))
}

/**
 * The grade a course counts with: an archived course uses its FROZEN
 * `finalPercent` (so history can't drift); a live one is computed from its
 * assessments. Null when there's nothing graded yet.
 */
export function courseFinalPercent(course: Course, assessments: Assessment[]): number | null {
  if (course.archived && typeof course.finalPercent === 'number') return course.finalPercent
  return coursePercent(assessments.filter((a) => a.courseId === course.id))
}

/** Credit-weighted GPA across courses that have at least one graded assessment. */
/**
 * Courses a repeat has superseded.
 *
 * Concordia counts only the LATEST attempt of a repeated course:
 *
 *   "In the case of repeated courses, only the grade corresponding to the
 *    latest attempt of the course will be used in the calculation of the CGPA."
 *
 * Counting both attempts is not a rounding difference, it is a different number
 * entirely: one failed 3-credit course dragged a real 22-course record from
 * 2.81 down to 2.66. The earlier attempt stays visible on the transcript,
 * because it happened - it just stops counting.
 *
 * "Latest" is decided by term order, and only among courses that actually have
 * a grade: an ungraded retake in progress must not suppress the grade you
 * already earned.
 */
export function supersededCourseIds(courses: Course[], assessments: Assessment[]): Set<string> {
  const byCode = new Map<string, Course[]>()
  for (const course of courses) {
    const code = course.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (!code) continue
    if (courseFinalPercent(course, assessments) === null) continue
    byCode.set(code, [...(byCode.get(code) ?? []), course])
  }

  const superseded = new Set<string>()
  for (const attempts of byCode.values()) {
    if (attempts.length < 2) continue
    const ordered = [...attempts].sort((a, b) => termRank(a.term) - termRank(b.term))
    // Everything but the last attempt stops counting.
    for (const course of ordered.slice(0, -1)) superseded.add(course.id)
  }
  return superseded
}

/** Credit-weighted GPA, with superseded attempts of repeated courses excluded. */
export function currentGpa(courses: Course[], assessments: Assessment[]): number | null {
  const superseded = supersededCourseIds(courses, assessments)
  let credits = 0
  let points = 0
  for (const course of courses) {
    if (superseded.has(course.id)) continue
    const percent = courseFinalPercent(course, assessments)
    if (percent === null) continue
    credits += course.credits
    points += percentToGrade(percent).points * course.credits
  }
  if (credits === 0) return null
  return points / credits
}

/** One line of the GPA calculation, so the number can be checked rather than
 *  trusted. */
export interface GpaLine {
  course: Course
  percent: number | null
  letter: string
  points: number
  credits: number
  /** An earlier attempt at a course that was later repeated. */
  superseded: boolean
}

/**
 * Every course that went into the GPA, and every one that did not.
 *
 * Exists so a student can put this side by side with their transcript and find
 * the row that differs, instead of taking our number on faith. When our GPA and
 * Concordia's disagree, the disagreement is always a specific course.
 */
export function gpaLines(courses: Course[], assessments: Assessment[]): GpaLine[] {
  const superseded = supersededCourseIds(courses, assessments)
  return courses
    .map((course) => {
      const percent = courseFinalPercent(course, assessments)
      const grade = percent === null ? null : percentToGrade(percent)
      return {
        course,
        percent,
        letter: grade?.letter ?? '',
        points: grade?.points ?? 0,
        credits: course.credits,
        superseded: superseded.has(course.id),
      }
    })
    .sort((a, b) => termRank(b.course.term) - termRank(a.course.term))
}

/** One past (or current) term on the transcript. */
export interface TermRecord {
  term: string
  courses: Course[]
  /** Credit-weighted GPA for this term alone (null if nothing graded). */
  gpa: number | null
  /** Credits counted toward the GPA (i.e. graded ones). */
  credits: number
}

/**
 * Group courses into terms with a per-term GPA, most recent first. Used by the
 * transcript view and the "since last term" delta.
 */
export function termRecords(
  courses: Course[],
  assessments: Assessment[],
  sortTerms: (terms: string[]) => string[],
): TermRecord[] {
  const byTerm = new Map<string, Course[]>()
  for (const c of courses) {
    const list = byTerm.get(c.term) ?? []
    list.push(c)
    byTerm.set(c.term, list)
  }
  return sortTerms([...byTerm.keys()]).map((term) => {
    const list = byTerm.get(term) ?? []
    let credits = 0
    for (const c of list) {
      if (courseFinalPercent(c, assessments) !== null) credits += c.credits
    }
    return { term, courses: list, gpa: currentGpa(list, assessments), credits }
  })
}

export interface CourseStanding {
  /** Weighted % over graded work so far (null when nothing graded). */
  currentPercent: number | null
  /** Weight already graded, as a share of the course's total weight. */
  gradedWeight: number
  /** Weight not yet graded — the room left to move the grade. */
  remainingWeight: number
  /** Sum of all assessment weights (≈100 for a complete syllabus). */
  totalWeight: number
  /** Graded contribution in grade points (Σ percentᵢ·weightᵢ / 100). */
  earnedPoints: number
}

/** Decompose a course into the pieces both calculators need. */
export function courseStanding(assessments: Assessment[]): CourseStanding {
  let gradedWeight = 0
  let earnedPoints = 0
  let totalWeight = 0
  for (const a of assessments) {
    totalWeight += a.weight
    const percent = gradeToPercent(a.grade)
    if (percent !== null) {
      gradedWeight += a.weight
      earnedPoints += (percent * a.weight) / 100
    }
  }
  return {
    currentPercent: gradedWeight === 0 ? null : (earnedPoints / gradedWeight) * 100,
    gradedWeight,
    remainingWeight: totalWeight - gradedWeight,
    totalWeight,
    earnedPoints,
  }
}

export type GradeNeeded =
  | { kind: 'needed'; percent: number; remainingWeight: number }
  | { kind: 'secured' } // already locked in regardless of remaining work
  | { kind: 'unreachable'; percent: number } // would need >100% on remaining
  | { kind: 'no-remaining' } // nothing left to grade

/** FREE calculator: the average needed on remaining work to hit `targetPercent`
 * as the final course grade. Real arithmetic, no rounding tricks. */
export function gradeNeeded(
  assessments: Assessment[],
  targetPercent: number,
): GradeNeeded {
  const { earnedPoints, remainingWeight, totalWeight } = courseStanding(assessments)
  if (remainingWeight <= 0) return { kind: 'no-remaining' }
  // earnedPoints + x/100 * remainingWeight = targetPercent/100 * totalWeight
  const needed =
    ((targetPercent / 100) * totalWeight - earnedPoints) / (remainingWeight / 100)
  if (needed <= 0) return { kind: 'secured' }
  if (needed > 100) return { kind: 'unreachable', percent: needed }
  return { kind: 'needed', percent: needed, remainingWeight }
}

/** PAID what-if: project the final course % assuming `assumedRemaining` average
 * on every not-yet-graded assessment. */
export function projectedCoursePercent(
  assessments: Assessment[],
  assumedRemaining: number,
): number | null {
  const { earnedPoints, remainingWeight, totalWeight } = courseStanding(assessments)
  if (totalWeight === 0) return null
  return ((earnedPoints + (assumedRemaining / 100) * remainingWeight) / totalWeight) * 100
}

/** PAID what-if: recompute the credit-weighted GPA with one course swapped for a
 * projected final %. Courses still ungraded (and not the override) are skipped. */
export function projectedGpa(
  courses: Course[],
  assessments: Assessment[],
  overrideCourseId: string,
  overridePercent: number,
): number | null {
  let credits = 0
  let points = 0
  for (const course of courses) {
    const percent =
      course.id === overrideCourseId
        ? overridePercent
        : coursePercent(assessments.filter((a) => a.courseId === course.id))
    if (percent === null) continue
    credits += course.credits
    points += percentToGrade(percent).points * course.credits
  }
  if (credits === 0) return null
  return points / credits
}
