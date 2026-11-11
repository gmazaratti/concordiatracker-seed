import { useMemo } from 'react'
import type { CalendarTask, Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { moodleByCourse, pairMoodleToAssessments } from '@/lib/moodle-match'

/** Courses in the order Moodle items should be matched against: current first. */
export function matchOrder(courses: Course[]): Course[] {
  return [...courses].sort((a, b) => Number(!!a.archived) - Number(!!b.archived))
}

/**
 * Every synced Moodle item, grouped by the course its own text names, plus the
 * assessment each one was paired with (so a row can say "same as Midterm"
 * instead of looking like a duplicate).
 */
export function useMoodleGroups() {
  const { personalTasks, courses, assessments } = useAppData()
  return useMemo(() => {
    const ordered = matchOrder(courses)
    const groups = moodleByCourse(personalTasks, ordered)
    const pairs = pairMoodleToAssessments(
      personalTasks,
      assessments.map((a) => ({ id: a.id, courseId: a.courseId, title: a.title, due: a.due })),
      ordered,
    )
    const pairedWith = new Map(pairs.map((p) => [p.taskId, p.title]))
    const total = [...groups.values()].reduce((n, l) => n + l.length, 0)
    return { groups, pairedWith, total }
  }, [personalTasks, courses, assessments])
}

/** Upcoming soonest first, then past newest first. */
export function splitByTime(items: CalendarTask[], now: number) {
  const upcoming = items.filter((t) => new Date(t.due).getTime() >= now).sort((a, b) => a.due.localeCompare(b.due))
  const past = items.filter((t) => new Date(t.due).getTime() < now).sort((a, b) => b.due.localeCompare(a.due))
  return { upcoming, past }
}

