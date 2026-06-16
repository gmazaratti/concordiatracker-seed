import { createContext, useContext } from 'react'

/** The five settings panes (Claude-desktop-style left nav). */
export type SettingsSection = 'general' | 'account' | 'privacy' | 'billing' | 'usage'

export interface SettingsContextValue {
  open: boolean
  section: SettingsSection
  /** Open the floating settings panel, optionally on a specific section. */
  openSettings: (section?: SettingsSection) => void
  closeSettings: () => void
  setSection: (section: SettingsSection) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within <SettingsProvider>')
  return ctx
}
