import { useMemo } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { gradeToPercent } from '@/lib/grade'
import { isOpen } from '@/lib/status'
import { useFeatureUsage } from './feature-usage'

export interface StarterTask {
  /** What to do, short enough to sit under the tab name. */
  label: string
}

/** How long an account counts as new. After this the dots stop, done or not. */
const NEW_FOR_DAYS = 30

/**
 * One first task per tab, for new accounts. The dot on the tab stays until the
 * task is actually done (measured from real data, never a "dismiss"), which is
 * the point: the features people never find are the ones nothing ever pointed
 * them at.
 *
 * Courses walks through three in order (a course, a grade, a past semester) and
 * shows the next one each time, so the tab is never asking for two things.
 */
export function useStarterTasks(): Record<string, StarterTask | undefined> {
  const { courses, pastCourses, assessments, personalTasks, dataLoading, user } = useAppData()
  const usage = useFeatureUsage()

  return useMemo(() => {
    const out: Record<string, StarterTask | undefined> = {}
    if (dataLoading || !usage) return out
    if ((usage.account_days ?? 0) > NEW_FOR_DAYS) return out

    if (assessments.length > 0 && !assessments.some((a) => !isOpen(a.status))) {
      out['/app'] = { label: 'Tick off your first deadline' }
    }

    if (courses.length === 0) out['/app/courses'] = { label: 'Add your first course' }
    else if (!assessments.some((a) => gradeToPercent(a.grade) !== null)) out['/app/courses'] = { label: 'Enter your first grade' }
    else if (pastCourses.length === 0) out['/app/courses'] = { label: 'Add a past semester' }

    if (!personalTasks.some((t) => !t.source)) out['/app/calendar'] = { label: 'Add your own task' }

    if (user.atConcordia && !usage.programme) out['/app/planner'] = { label: 'Set your programme' }
    else if (user.atConcordia && !usage.schedule) out['/app/planner'] = { label: 'Build a schedule' }

    if (!usage.notes) out['/app/notes'] = { label: 'Write your first note' }
    if (!usage.clubs) out['/app/community'] = { label: 'Follow a club' }
    return out
  }, [courses, pastCourses, assessments, personalTasks, dataLoading, user.atConcordia, usage])
}
