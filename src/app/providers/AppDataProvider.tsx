import { useCallback, useMemo, useState } from 'react'
import { AppDataContext } from './app-data'
import { courses, currentUser, seedAssessments } from '@/data/mock'
import type { Course, Plan } from '@/data/types'

/** Holds the cloned seed so UI mutations never touch the module-level data. */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>(currentUser.plan)
  const [assessments, setAssessments] = useState(() =>
    seedAssessments.map((a) => ({ ...a })),
  )

  const toggleDone = useCallback((id: string) => {
    setAssessments((list) =>
      list.map((a) => (a.id === id ? { ...a, done: !a.done } : a)),
    )
  }, [])

  const courseById = useCallback(
    (id: string): Course | undefined => courses.find((c) => c.id === id),
    [],
  )

  const value = useMemo(
    () => ({
      user: { ...currentUser, plan },
      plan,
      setPlan,
      courses,
      assessments,
      toggleDone,
      courseById,
    }),
    [plan, assessments, toggleDone, courseById],
  )

  return <AppDataContext value={value}>{children}</AppDataContext>
}
