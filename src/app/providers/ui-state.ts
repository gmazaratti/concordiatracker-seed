import { createContext, useContext } from 'react'

/** Lightweight, per-user, cross-device UI flags (stored in user_profile.ui_state). */
export interface UiState {
  checklistDismissed?: boolean
  communityVisited?: boolean
  tipsSeen?: string[]
  /** Opt-in: pin the feature-requests board as a sidebar item. */
  feedbackPinned?: boolean
  /** Shown the "take a tour" welcome prompt once (after onboarding). */
  tourPromptSeen?: boolean
  /** Attribution — where the user first heard about us (onboarding). */
  heardFrom?: string
  /** Free-text detail when heardFrom === 'other' (e.g. "a Discord server"). */
  heardFromDetail?: string
  /** Distinct local days the user has opened the app (YYYY-MM-DD, capped). Used
   * to gate the feedback survey ("used it for ≥3 unique days"). */
  visitDays?: string[]
  /** Completed the feedback survey (hide the entry once done). */
  surveyDone?: boolean
  /** Dismissed the survey nudge without completing it. */
  surveyDismissed?: boolean
}

/** Local calendar day as YYYY-MM-DD (not UTC — a late-night session counts as
 * "today" for the person using it). */
export function localDay(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface UiStateContextValue {
  uiState: UiState
  /** False until the row has been read (so one-time tips don't flash pre-load). */
  loaded: boolean
  patchUiState: (patch: Partial<UiState>) => void
  markTipSeen: (id: string) => void
  isTipSeen: (id: string) => boolean
}

export const UiStateContext = createContext<UiStateContextValue | null>(null)

export function useUiState(): UiStateContextValue {
  const ctx = useContext(UiStateContext)
  if (!ctx) throw new Error('useUiState must be used within <UiStateProvider>')
  return ctx
}
