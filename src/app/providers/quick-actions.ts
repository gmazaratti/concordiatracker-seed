import { createContext, useContext } from 'react'

/** What the command palette can open in a focused popup. */
export type QuickTarget =
  | { kind: 'assessment'; id: string }
  | { kind: 'course'; id: string }

/** A pending, reversible action — the Gmail-style "Undo" affordance. */
export interface UndoEntry {
  /** Bumped on each flash so the toast remounts (restarts its timer). */
  key: number
  label: string
  run: () => void
}

export interface QuickActionsContextValue {
  target: QuickTarget | null
  openAssessment: (id: string) => void
  openCourse: (id: string) => void
  closeTarget: () => void
  undo: UndoEntry | null
  /** Show a transient toast whose button calls `run` to revert the action. */
  flashUndo: (label: string, run: () => void) => void
  dismissUndo: () => void
}

export const QuickActionsContext =
  createContext<QuickActionsContextValue | null>(null)

export function useQuickActions(): QuickActionsContextValue {
  const ctx = useContext(QuickActionsContext)
  if (!ctx)
    throw new Error('useQuickActions must be used within <QuickActionsProvider>')
  return ctx
}
