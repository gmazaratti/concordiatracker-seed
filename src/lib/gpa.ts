import type { Assessment, AssessmentKind, Course } from '@/data/types'
import { gradeToPercent } from './grade'

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

/** Credit-weighted GPA across courses that have at least one graded assessment. */
export function currentGpa(courses: Course[], assessments: Assessment[]): number | null {
  let credits = 0
  let points = 0
  for (const course of courses) {
    const percent = coursePercent(assessments.filter((a) => a.courseId === course.id))
    if (percent === null) continue
    credits += course.credits
    points += percentToGrade(percent).points * course.credits
  }
  if (credits === 0) return null
  return points / credits
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
