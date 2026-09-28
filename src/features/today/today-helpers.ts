import { useMemo } from 'react'
import type { Assessment, CalendarTask, Course } from '@/data/types'
import { daysUntil } from '@/lib/date'
import { coveredTaskIds, pairMoodleToAssessments } from '@/lib/moodle-match'

/** Which greeting to show — the hour is read at render time, like the rest of
 * Today's clock-relative copy. */
export function greetingKey(): 'today.goodMorning' | 'today.goodAfternoon' | 'today.goodEvening' {
  const h = new Date().getHours()
  if (h < 12) return 'today.goodMorning'
  if (h < 18) return 'today.goodAfternoon'
  return 'today.goodEvening'
}

/** Overdue and near-term totals for Moodle rows. Module-level so reading the
 *  clock is allowed (`react-hooks/purity` bars it inside a component). */
export function countNear(tasks: { due: string }[]): { overdue: number; near: number } {
  let overdue = 0
  let near = 0
  for (const tk of tasks) {
    const d = daysUntil(tk.due)
    if (d < 0) overdue++
    if (d < 7) near++
  }
  return { overdue, near }
}

/** Today's todo rows and their counts (see below). */
export function useTodosDue(personalTasks: CalendarTask[], assessments: Assessment[], courses: Course[]) {
  /**
   * Todos that are NOT a second copy of something already here.
   *
   * THIS IS THE DUPLICATE ANSWER. A synced "Assignment 2 is due" and the
   * Assignment 2 on your course are the same piece of work, and showing both
   * would double the list for anyone whose syllabus is also in Moodle. The
   * assessment wins — it carries the weight and your grade — and the synced
   * copy is dropped. What survives is the deadlines no syllabus lists, which
   * is exactly what connecting Moodle was for — alongside anything you put on
   * your own calendar, because a study block you set for this evening belongs
   * on the screen you check this evening.
   *
   * Anything still open, and undone.
   */
  const todosDue = useMemo(() => {
    const covered = coveredTaskIds(pairMoodleToAssessments(personalTasks, assessments, courses))
    return personalTasks.filter((tk) => !tk.done && !covered.has(tk.id))
  }, [personalTasks, assessments, courses])
  /**
   * The same two numbers the rail shows, for the Moodle half.
   *
   * Counted here rather than left out, because a rail reading "3 left" beside
   * a list of five rows is the kind of small inconsistency that makes someone
   * distrust both numbers.
   */
  const todoCounts = useMemo(() => countNear(todosDue), [todosDue])
  return { todosDue, todoCounts }
}
