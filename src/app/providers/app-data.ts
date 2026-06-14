import { createContext, useContext } from 'react'
import type { Assessment, Course, Plan, User } from '@/data/types'

/** The in-memory app store. Everything is mock + ephemeral: toggling "done" or
 * flipping the plan lives only for the session, matching the seed's no-backend
 * rule. */
export interface AppDataContextValue {
  user: User
  plan: Plan
  setPlan: (plan: Plan) => void
  courses: Course[]
  assessments: Assessment[]
  toggleDone: (id: string) => void
  courseById: (id: string) => Course | undefined
}

export const AppDataContext = createContext<AppDataContextValue | null>(null)

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within <AppDataProvider>')
  return ctx
}
