import { createContext, useContext } from 'react'

/** The in-memory update/version state: which version the user last saw, the
 * notification opt-out, and the on-demand history view. "Last seen" persistence
 * is mock for now (resets on reload) — a real backend slots in behind this. */
export interface UpdatesContextValue {
  currentVersion: string
  lastSeenVersion: string
  /** A newer release exists than the one the user last viewed. */
  hasUnseen: boolean
  /** Opt-out: when off, no toast and no dot (history stays accessible). */
  notificationsEnabled: boolean
  setNotificationsEnabled: (on: boolean) => void
  /** Show the persistent dot (unseen AND notifications on). */
  showIndicator: boolean
  /** Show the transient toast (indicator on AND not dismissed this session). */
  showToast: boolean
  /** Hide the toast without marking the update seen (the dot remains). */
  dismissToast: () => void
  isHistoryOpen: boolean
  /** Open the history view and mark the current version seen (clears the dot). */
  openHistory: () => void
  closeHistory: () => void
}

export const UpdatesContext = createContext<UpdatesContextValue | null>(null)

export function useUpdates(): UpdatesContextValue {
  const ctx = useContext(UpdatesContext)
  if (!ctx) throw new Error('useUpdates must be used within <UpdatesProvider>')
  return ctx
}
