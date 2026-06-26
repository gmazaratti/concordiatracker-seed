import { createContext, useContext } from 'react'

/** Lightweight, per-user, cross-device UI flags (stored in user_profile.ui_state). */
export interface UiState {
  checklistDismissed?: boolean
  communityVisited?: boolean
  tipsSeen?: string[]
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
