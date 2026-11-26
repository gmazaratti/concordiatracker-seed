import { useCallback, useMemo } from 'react'
import { useUiState } from '@/app/providers/ui-state'
import { nextTerm, planKey, rollForward, type CoursePlan, type PlanCourse } from '@/lib/course-plan'
import { currentTermName } from '../past-terms'

/**
 * The student's course sequence, kept with the rest of their saved layout so
 * it follows them between devices. Every change goes through here.
 */
export function useCoursePlan() {
  const { uiState, patchUiState } = useUiState()
  const current = currentTermName()
  const plan = useMemo(() => rollForward(uiState.coursePlan ?? { terms: [] }, current), [uiState.coursePlan, current])

  const save = useCallback((next: CoursePlan) => patchUiState({ coursePlan: next }), [patchUiState])
  const edit = useCallback(
    (fn: (terms: CoursePlan['terms']) => CoursePlan['terms']) => save({ terms: fn(plan.terms.map((t) => ({ ...t, courses: [...t.courses] }))) }),
    [plan, save],
  )

  return {
    plan,
    current,
    add: (i: number, course: PlanCourse) =>
      edit((terms) => {
        if (terms[i] && !terms[i].courses.some((c) => planKey(c.code) === planKey(course.code))) terms[i].courses.push(course)
        return terms
      }),
    remove: (i: number, code: string) =>
      edit((terms) => {
        terms[i].courses = terms[i].courses.filter((c) => planKey(c.code) !== planKey(code))
        return terms
      }),
    move: (from: number, code: string, to: number) =>
      edit((terms) => {
        if (from === to || !terms[from] || !terms[to]) return terms
        const course = terms[from].courses.find((c) => planKey(c.code) === planKey(code))
        if (!course) return terms
        terms[from].courses = terms[from].courses.filter((c) => c !== course)
        if (!terms[to].courses.some((c) => planKey(c.code) === planKey(code))) terms[to].courses.push(course)
        return terms
      }),
    setWork: (i: number, work: boolean) =>
      edit((terms) => {
        terms[i].work = work
        return terms
      }),
    addTerm: () =>
      edit((terms) => {
        const name = nextTerm(terms.at(-1)?.term ?? current)
        return name ? [...terms, { term: name, courses: [] }] : terms
      }),
    removeLastTerm: () => edit((terms) => (terms.length > 1 ? terms.slice(0, -1) : terms)),
  }
}
