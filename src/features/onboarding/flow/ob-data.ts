import { percentToGrade } from '@/lib/gpa'

/** The sample outline every step builds on: four items, weights total 100. */
export const OUTLINE = [
  { id: 'q1', kind: 'Quiz', title: 'Quiz 1', due: 'Sep 24', weight: 10 },
  { id: 'a1', kind: 'Assignment', title: 'Case analysis', due: 'Oct 8', weight: 20 },
  { id: 'mt', kind: 'Midterm', title: 'Midterm exam', due: 'Oct 27', weight: 30 },
  { id: 'fe', kind: 'Final', title: 'Final exam', due: 'Dec 12', weight: 40 },
] as const

/** "17/20" or "85" -> a percentage, or null while it is not a grade yet. */
export function readGrade(text: string): number | null {
  const t = text.trim()
  const frac = t.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/)
  if (frac) {
    const total = Number(frac[2])
    const got = Number(frac[1])
    return total > 0 && got <= total ? (got / total) * 100 : null
  }
  if (!/^\d+(?:\.\d+)?%?$/.test(t)) return null
  const n = Number(t.replace('%', ''))
  return n >= 0 && n <= 100 ? n : null
}

/** Grades already "in" for the demo course, besides the quiz the visitor types. */
const CASE = 82
const MIDTERM = 71

/** Points earned so far out of 100, with the quiz at `quiz` percent. */
export function earnedSoFar(quiz: number): number {
  return (quiz * 10 + CASE * 20 + MIDTERM * 30) / 100
}

/** Standing on the 60% graded so far. */
export function standing(quiz: number): number {
  return (earnedSoFar(quiz) / 60) * 100
}

/** The final-exam mark needed to finish the course at `target` percent. */
export function neededOnFinal(quiz: number, target: number): number {
  return ((target - earnedSoFar(quiz)) / 40) * 100
}

export const TARGETS = [
  { letter: 'A-', min: 80 },
  { letter: 'B+', min: 77 },
  { letter: 'B', min: 73 },
  { letter: 'C', min: 63 },
] as const

/** The other three classes in the what-if: fixed grades, 3 credits each. */
const OTHERS = [78, 88, 64]

/** Credit-weighted GPA on the 4.30 scale with COMM 305 at `percent`. */
export function gpaWith(percent: number): number {
  const points = [percent, ...OTHERS].map((p) => percentToGrade(p).points)
  return points.reduce((a, b) => a + b, 0) / points.length
}

export interface PlanCourse {
  id: string
  code: string
  color: string
  /** [day 0-4, start hour, end hour] per meeting. `alt` is the other section. */
  meets: [number, number, number][]
  alt?: [number, number, number][]
}

export const PLAN: PlanCourse[] = [
  { id: 'comm', code: 'COMM 305', color: '#5b8def', meets: [[0, 10, 11.5], [2, 10, 11.5]] },
  { id: 'fina', code: 'FINA 210', color: '#e0a23c', meets: [[1, 13, 14.5], [3, 13, 14.5]] },
  { id: 'reli', code: 'RELI 230', color: '#c96aa8', meets: [[0, 11, 12.5], [2, 11, 12.5]], alt: [[1, 9.5, 11], [3, 9.5, 11]] },
  { id: 'math', code: 'MATH 208', color: '#4fb39a', meets: [[4, 10, 13]] },
]

export function overlaps(a: [number, number, number], b: [number, number, number]): boolean {
  return a[0] === b[0] && a[1] < b[2] && b[1] < a[2]
}

export const GOALS = [
  { id: 'deadlines', label: 'Never miss a deadline', first: 'Scan your first outline' },
  { id: 'gpa', label: 'Raise my GPA', first: 'Add past courses and see your real GPA' },
  { id: 'plan', label: 'Plan my degree', first: 'Build next term in the schedule builder' },
  { id: 'people', label: 'Find my people', first: 'Follow two clubs and see this week on campus' },
  { id: 'parents', label: 'Keep my parents in the loop', first: 'Send a view-only family link' },
] as const

/** Set when onboarding finishes; Today reads it once and plays its entrance. */
export const ARRIVE_KEY = 'ct_arrive'
