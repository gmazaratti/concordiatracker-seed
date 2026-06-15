import { createContext, useContext } from 'react'
import type {
  Assessment,
  AssessmentStatus,
  Course,
  Grade,
  Plan,
  User,
} from '@/data/types'

/** The in-memory app store. Everything is mock + ephemeral: editing a status,
 * grade, or note — or flipping the plan — lives only for the session, matching
 * the seed's no-backend rule. These mutations are the shared write surface for
 * both Today (status only) and the Courses grade editor. */
export interface AppDataContextValue {
  user: User
  plan: Plan
  setPlan: (plan: Plan) => void
  courses: Course[]
  assessments: Assessment[]
  setStatus: (id: string, status: AssessmentStatus) => void
  setGrade: (id: string, grade: Grade | null) => void
  setNotes: (id: string, notes: string) => void
  /** Append parsed assessments (the syllabus parse-reveal commits through here). */
  addAssessments: (items: Assessment[]) => void
  courseById: (id: string) => Course | undefined
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within <AppDataProvider>')
  return ctx
}
