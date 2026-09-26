import { useSyncExternalStore } from 'react'

/**
 * "You just finished this; what did you get?" (features/courses/GradePrompt).
 *
 * A tiny store so any completion action (Today's check-off, the course
 * detail's done toggle or status dropdown) can ask for a grade without
 * knowing where the prompt lives. One at a time: a newer completion replaces
 * the question, since the older one can always be graded from the course.
 */
let current: string | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function askForGrade(assessmentId: string): void {
  current = assessmentId
  emit()
}

export function closeGradePrompt(): void {
  if (current === null) return
  current = null
  emit()
}

export function useGradePromptId(): string | null {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => current,
    () => null,
  )
}
