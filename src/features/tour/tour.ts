import { createContext, useContext } from 'react'

/** A guided-tour step, defined as DATA so steps can be added / edited / reordered
 * without touching the engine. */
export interface TourStep {
  id: string
  /** CSS selector for the element to spotlight. Omit for a centered explainer card. */
  target?: string
  title: string
  body: string
  /** Route the engine navigates to before showing this step. */
  route?: string
  /** 'read' advances on Space/Next; 'action' advances when the target is used. */
  type: 'read' | 'action'
  /** Preferred tooltip side relative to the target (engine clamps to fit). */
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export interface TourContextValue {
  active: boolean
  step: TourStep | null
  index: number
  total: number
  /** Begin a tour with the given steps; onDone fires when it ends or is skipped. */
  start: (steps: TourStep[], onDone?: () => void) => void
  next: () => void
  back: () => void
  /** End (and run onDone) — used by Skip + the final Done. */
  end: () => void
}

export const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within <TourProvider>')
  return ctx
}
