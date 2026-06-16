import { useCallback, useMemo, useState } from 'react'
import { SettingsContext, type SettingsSection } from './settings'

/** Owns the floating settings panel's open/section state. App-level so the gear
 * icon, avatar menu, command palette, and paywall CTAs can all open it. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState<SettingsSection>('general')

  const openSettings = useCallback((next?: SettingsSection) => {
    if (next) setSection(next)
    setOpen(true)
  }, [])
  const closeSettings = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ open, section, openSettings, closeSettings, setSection }),
    [open, section, openSettings, closeSettings],
  )

  return <SettingsContext value={value}>{children}</SettingsContext>
}
