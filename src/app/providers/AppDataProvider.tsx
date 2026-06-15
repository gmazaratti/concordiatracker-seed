import { useCallback, useMemo, useState } from 'react'
import { AppDataContext } from './app-data'
import { courses, currentUser, seedAssessments } from '@/data/mock'
import type { Assessment, AssessmentStatus, Course, Grade, Plan } from '@/data/types'

/** Holds the cloned seed so UI mutations never touch the module-level data. */
export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [plan, setPlan] = useState<Plan>(currentUser.plan)
  const [assessments, setAssessments] = useState(() =>
    seedAssessments.map((a) => ({ ...a })),
  )

  // Shared write surface: Today flips status; Courses edits status/grade/notes.
  const setStatus = useCallback((id: string, status: AssessmentStatus) => {
    setAssessments((list) =>
      list.map((a) => (a.id === id ? { ...a, status } : a)),
    )
  }, [])

  const setGrade = useCallback((id: string, grade: Grade | null) => {
    setAssessments((list) =>
      list.map((a) => (a.id === id ? { ...a, grade } : a)),
    )
  }, [])

  const setNotes = useCallback((id: string, notes: string) => {
    setAssessments((list) =>
      list.map((a) => (a.id === id ? { ...a, notes } : a)),
    )
  }, [])

  const addAssessments = useCallback((items: Assessment[]) => {
    setAssessments((list) => {
      const existing = new Set(list.map((a) => a.id))
      const fresh = items.filter((a) => !existing.has(a.id))
      return fresh.length === 0 ? list : [...list, ...fresh]
    })
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
      setStatus,
      setGrade,
      setNotes,
      addAssessments,
      courseById,
    }),
    [plan, assessments, setStatus, setGrade, setNotes, addAssessments, courseById],
  )

  return <AppDataContext value={value}>{children}</AppDataContext>
}
