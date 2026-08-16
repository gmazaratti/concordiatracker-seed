import type { Assessment, Course } from '@/data/types'
import { daysUntil } from './date'
import { courseStanding } from './gpa'
import { isOpen } from './status'

/**
 * A rule-based study planner. Deliberately NOT "AI" — every number here is
 * arithmetic the student can check, which is the same honesty rule the
 * grade-needed calculator follows.
 *
 * Priority for a piece of work =
 *
 *     weight  ×  urgency  ×  leverage
 *
 *   • weight   — what it's worth in the course (a 40% final beats a 5% quiz)
 *   • urgency  — how soon it's due (overdue and imminent work dominates)
 *   • leverage — how much the COURSE still needs you: a class where lots of
 *                weight is ungraded, or where you're currently weakest, moves
 *                more per hour spent than one already locked in.
 *
 * The result is a ranked list with a plain-English reason for each item, plus a
 * suggested share of study time (each item's score as a fraction of the total).
 */

export interface StudyItem {
  assessment: Assessment
  course: Course | undefined
  /** Raw priority score (unitless — only meaningful relative to the others). */
  score: number
  /** Share of the planned study time, 0–100, summing to ~100 across items. */
  share: number
  /** Why this ranks here, in plain language. */
  reasons: string[]
  daysLeft: number
}

export interface StudyPlan {
  items: StudyItem[]
  /** Items due within the horizon that are already done — nothing to plan. */
  horizonDays: number
  /** One-line framing of the plan ("Three things matter this week…"). */
  headline: string
}

/** How soon it's due → a multiplier. Overdue work dominates; far-off work decays
 * toward 1 so it never disappears entirely. */
function urgencyFactor(days: number): number {
  if (days < 0) return 3.0 // overdue
  if (days <= 1) return 2.6
  if (days <= 3) return 2.1
  if (days <= 7) return 1.6
  if (days <= 14) return 1.2
  return 1.0
}

/**
 * How much the course still moves per hour spent. Two honest signals:
 *   • remaining ungraded weight (nothing left to grade → little leverage)
 *   • current standing (a weaker class needs the hours more)
 */
function leverageFactor(courseAssessments: Assessment[]): number {
  const s = courseStanding(courseAssessments)
  const remainingShare = s.totalWeight > 0 ? s.remainingWeight / s.totalWeight : 1
  // 0.8 → 1.4 as more of the course is still up for grabs.
  const room = 0.8 + remainingShare * 0.6
  // A course sitting below ~70% gets up to a 25% boost; a strong one gets none.
  const standing = s.currentPercent
  const need = standing === null ? 1.1 : standing < 70 ? 1.25 : standing < 80 ? 1.12 : 1.0
  return room * need
}

function reasonsFor(a: Assessment, days: number, courseAssessments: Assessment[]): string[] {
  const out: string[] = []
  if (days < 0) out.push(`${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`)
  else if (days === 0) out.push('due today')
  else if (days <= 3) out.push(`due in ${days} day${days === 1 ? '' : 's'}`)
  if (a.weight >= 25) out.push(`worth ${a.weight}% of the course`)
  else if (a.weight >= 10) out.push(`${a.weight}% of the grade`)
  const standing = courseStanding(courseAssessments).currentPercent
  if (standing !== null && standing < 70) out.push('your weakest class right now')
  return out
}

/**
 * Build a ranked study plan over the next `horizonDays`. Only OPEN work counts —
 * anything done, missed, or already graded is out.
 */
export function buildStudyPlan(
  courses: Course[],
  assessments: Assessment[],
  { horizonDays = 14, limit = 6 }: { horizonDays?: number; limit?: number } = {},
): StudyPlan {
  const byCourse = new Map<string, Assessment[]>()
  for (const a of assessments) {
    const list = byCourse.get(a.courseId) ?? []
    list.push(a)
    byCourse.set(a.courseId, list)
  }

  const scored: StudyItem[] = []
  for (const a of assessments) {
    if (!isOpen(a.status)) continue
    const days = daysUntil(a.due)
    if (days > horizonDays) continue
    const courseAssessments = byCourse.get(a.courseId) ?? []
    const score = Math.max(a.weight, 1) * urgencyFactor(days) * leverageFactor(courseAssessments)
    scored.push({
      assessment: a,
      course: courses.find((c) => c.id === a.courseId),
      score,
      share: 0,
      reasons: reasonsFor(a, days, courseAssessments),
      daysLeft: days,
    })
  }

  scored.sort((x, y) => y.score - x.score)
  const items = scored.slice(0, limit)
  const total = items.reduce((sum, i) => sum + i.score, 0)
  for (const i of items) i.share = total > 0 ? Math.round((i.score / total) * 100) : 0
  // Rounding leaves the shares summing to 99–101; hand the remainder to the top
  // item so the column adds up to exactly 100 for anyone who checks.
  if (items.length > 0) {
    const drift = 100 - items.reduce((sum, i) => sum + i.share, 0)
    items[0].share = Math.max(0, items[0].share + drift)
  }

  return { items, horizonDays, headline: headlineFor(items, horizonDays) }
}

function headlineFor(items: StudyItem[], horizonDays: number): string {
  if (items.length === 0) return `Nothing due in the next ${horizonDays} days: a good week to get ahead.`

  const top = items[0]
  const label = top.course?.code ? `${top.course.code} ` : ''
  const lead =
    top.daysLeft < 0
      ? `${label}${top.assessment.title} is overdue and still the biggest lever: start there.`
      : `Start with ${label}${top.assessment.title}: it carries the most weight right now.`

  // Overdue work that ISN'T top of the list gets a truthful mention rather than
  // a "do this first" claim the ranking below would contradict.
  const otherOverdue = items.slice(1).filter((i) => i.daysLeft < 0).length
  if (otherOverdue > 0) {
    return `${lead} ${otherOverdue} smaller item${otherOverdue === 1 ? ' is' : 's are'} overdue: mop up after.`
  }
  return lead
}
