import type { Assessment, Course } from '@/data/types'

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

/** Weighted percentage across a course's graded assessments, normalized by the
 * weight actually graded so far (so a partial term still reads sensibly).
 * Returns null when nothing in the course is graded yet. */
export function coursePercent(assessments: Assessment[]): number | null {
  const graded = assessments.filter((a) => a.score !== null)
  if (graded.length === 0) return null
  const totalWeight = graded.reduce((sum, a) => sum + a.weight, 0)
  if (totalWeight === 0) return null
  const earned = graded.reduce((sum, a) => sum + a.score! * a.weight, 0)
  return earned / totalWeight
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
