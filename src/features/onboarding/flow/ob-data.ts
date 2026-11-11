import { percentToGrade } from '@/lib/gpa'

/** The sample outline every step builds on: four items, weights total 100. `inDays` keeps the dates upcoming. */
export const OUTLINE = [
  { id: 'q1', kind: 'Quiz', title: 'Quiz 1', inDays: 2, weight: 10 },
  { id: 'a1', kind: 'Assignment', title: 'Case analysis', inDays: 5, weight: 20 },
  { id: 'mt', kind: 'Midterm', title: 'Midterm exam', inDays: 9, weight: 30 },
  { id: 'fe', kind: 'Final', title: 'Final exam', inDays: 30, weight: 40 },
] as const

/** "Nov 13" / "13 nov." for a sample item, in the reader's language. */
export function sampleDue(inDays: number, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric' }).format(new Date(Date.now() + inDays * 86_400_000))
}

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

/** Goal ids; the words are in ob-i18n (goal.* and first.*). Order = the order shown. */
export const GOALS = ['deadlines', 'gpa', 'plan', 'seats', 'notes', 'events', 'people', 'parents'] as const
export type GoalId = (typeof GOALS)[number]

/** Set when onboarding finishes; Today reads it once and plays its entrance. */
export const ARRIVE_KEY = 'ct_arrive'
