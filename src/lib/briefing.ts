import type { Assessment, Course } from '@/data/types'
import { daysUntil } from './date'
import { courseStanding, gradeNeeded } from './gpa'
import { isOpen } from './status'
import { buildStudyPlan } from './study-plan'
import { heaviestWeek, termWorkload, workloadInsight } from './workload'

/**
 * The Daily Debrief's text. Rule-based and derived entirely from the student's
 * own data — the "focus" they pick just changes which true thing we lead with,
 * never invents one.
 */

export type FocusId = 'balanced' | 'catch-up' | 'grades' | 'ahead' | `course:${string}`

export interface FocusOption {
  id: FocusId
  label: string
}

/** The focus chips offered, given what's actually going on. */
export function focusOptions(courses: Course[], assessments: Assessment[]): FocusOption[] {
  const hasOverdue = assessments.some((a) => isOpen(a.status) && daysUntil(a.due) < 0)
  const out: FocusOption[] = [{ id: 'balanced', label: 'Balanced' }]
  if (hasOverdue) out.push({ id: 'catch-up', label: 'Catch up' })
  out.push({ id: 'grades', label: 'Protect my GPA' }, { id: 'ahead', label: 'Get ahead' })
  for (const c of courses) {
    if (c.code) out.push({ id: `course:${c.id}`, label: c.code })
  }
  return out
}

export interface Briefing {
  /** The main paragraph — what to know right now. */
  text: string
  /** A short supporting line (may be empty). */
  detail: string
}

const pct = (n: number) => `${Math.round(n)}%`

export function buildBriefing(
  courses: Course[],
  assessments: Assessment[],
  focus: FocusId,
  termStart: string,
  termEnd: string,
): Briefing {
  const open = assessments.filter((a) => isOpen(a.status))
  const overdue = open.filter((a) => daysUntil(a.due) < 0)
  const soon = open.filter((a) => {
    const d = daysUntil(a.due)
    return d >= 0 && d <= 7
  })

  if (open.length === 0) {
    return {
      text: 'Nothing open right now: you are genuinely clear.',
      detail: 'A good moment to read ahead or bank some work for the busy weeks.',
    }
  }

  // ── A specific course ────────────────────────────────────────────────────
  if (focus.startsWith('course:')) {
    const id = focus.slice('course:'.length)
    const course = courses.find((c) => c.id === id)
    const mine = assessments.filter((a) => a.courseId === id)
    const openMine = mine.filter((a) => isOpen(a.status))
    const standing = courseStanding(mine)
    const code = course?.code ?? 'This course'

    if (openMine.length === 0) {
      const cur = standing.currentPercent
      return {
        text: `${code} is clear: nothing open.`,
        detail: cur === null ? 'No grades in yet.' : `You are sitting at ${pct(cur)} on graded work.`,
      }
    }
    const next = [...openMine].sort((a, b) => daysUntil(a.due) - daysUntil(b.due))[0]
    const cur = standing.currentPercent
    const standingLine =
      cur === null
        ? `Nothing graded yet, so these first marks set the tone.`
        : `You are at ${pct(cur)} with ${pct(standing.remainingWeight)} of the grade still unmarked.`
    const late = daysUntil(next.due) < 0
    return {
      text: late
        ? `Focusing ${code}: ${next.title} is overdue by ${dueWord(next)}, worth ${next.weight}%.`
        : `Focusing ${code}: ${next.title} is next, worth ${next.weight}% and due ${dueWord(next)}.`,
      detail: standingLine,
    }
  }

  // ── Catch up on overdue ──────────────────────────────────────────────────
  if (focus === 'catch-up') {
    if (overdue.length === 0) {
      return { text: 'Nothing is overdue: you are caught up.', detail: 'Switch to Get ahead to bank some time.' }
    }
    const biggest = [...overdue].sort((a, b) => b.weight - a.weight)[0]
    const code = courses.find((c) => c.id === biggest.courseId)?.code ?? ''
    const weightSum = Math.round(overdue.reduce((s, a) => s + a.weight, 0))
    return {
      text: `${overdue.length} item${overdue.length === 1 ? '' : 's'} overdue, ${weightSum}% of grades between them. Start with ${code ? `${code} ` : ''}${biggest.title}.`,
      detail: 'Late work often still earns partial credit: worth more than a perfect start on something new.',
    }
  }

  // ── Protect the GPA ──────────────────────────────────────────────────────
  if (focus === 'grades') {
    // The class where the grade is most at risk: lowest standing with room left.
    let worst: { course: Course; percent: number; remaining: number } | null = null
    for (const c of courses) {
      const s = courseStanding(assessments.filter((a) => a.courseId === c.id))
      if (s.currentPercent === null || s.remainingWeight <= 0) continue
      if (!worst || s.currentPercent < worst.percent) {
        worst = { course: c, percent: s.currentPercent, remaining: s.remainingWeight }
      }
    }
    if (!worst) {
      return {
        text: 'No grades are in yet, so there is nothing at risk to protect.',
        detail: 'Once marks land, this will point at the class that needs defending.',
      }
    }
    const need = gradeNeeded(assessments.filter((a) => a.courseId === worst!.course.id), 80)
    const needLine =
      need.kind === 'needed'
        ? `To finish at a B-, you need ${pct(need.percent)} across the remaining ${pct(worst.remaining)}.`
        : need.kind === 'secured'
          ? 'A B- is already secured there.'
          : 'That target is out of reach now: aim for the next band down.'
    return {
      text: `${worst.course.code} is your softest grade at ${pct(worst.percent)}, with ${pct(worst.remaining)} still unmarked.`,
      detail: needLine,
    }
  }

  // ── Get ahead ────────────────────────────────────────────────────────────
  if (focus === 'ahead') {
    const weeks = termWorkload(assessments, termStart, termEnd)
    const peak = heaviestWeek(weeks)
    const insight = workloadInsight(weeks, courses)
    if (!peak || !insight) {
      return { text: 'Nothing scheduled far out yet.', detail: 'Import a syllabus and this will map your term.' }
    }
    const current = weeks.find((w) => w.current)?.week ?? 1
    const away = peak.week - current
    return {
      text:
        away > 0
          ? `Your crunch is week ${peak.week}, ${away} week${away === 1 ? '' : 's'} out. Work you bank now is work you will not be doing then.`
          : `You are in the heaviest week of the term right now.`,
      detail: insight.text,
    }
  }

  // ── Balanced (default) ───────────────────────────────────────────────────
  const plan = buildStudyPlan(courses, assessments, { horizonDays: 7, limit: 3 })
  const top = plan.items[0]
  if (!top) {
    return {
      text: 'Nothing due in the next seven days.',
      detail: 'Quiet week: a good one to get ahead of the next crunch.',
    }
  }
  const code = top.course?.code ? `${top.course.code} ` : ''
  const overduePart =
    overdue.length > 0 ? ` ${overdue.length} item${overdue.length === 1 ? ' is' : 's are'} overdue.` : ''
  // Count, not a summed percentage: weights belong to different courses, so
  // adding them ("90% of your grades") would claim a share that can't exist.
  const heaviest = Math.max(...soon.map((a) => a.weight), 0)
  const load =
    soon.length === 0
      ? 'Nothing new lands in the next seven days.'
      : `${soon.length} thing${soon.length === 1 ? '' : 's'} due in the next seven days${heaviest > 0 ? `, the biggest worth ${heaviest}%` : ''}.`
  const late = daysUntil(top.assessment.due) < 0
  return {
    text: `${load}${overduePart}`,
    detail: late
      ? `Biggest lever: ${code}${top.assessment.title}, worth ${top.assessment.weight}% and ${dueWord(top.assessment)} overdue.`
      : `Biggest lever: ${code}${top.assessment.title}, worth ${top.assessment.weight}% and due ${dueWord(top.assessment)}.`,
  }
}

function dueWord(a: Assessment): string {
  const d = daysUntil(a.due)
  // Overdue reads as a bare duration ("2 days") so callers can frame it.
  if (d < 0) return `${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'}`
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  return `in ${d} days`
}
