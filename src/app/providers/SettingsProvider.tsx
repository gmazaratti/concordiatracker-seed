import { useCallback, useEffect, useMemo, useState } from 'react'
import { SettingsContext, type SettingsSection } from './settings'
import { PURCHASES_HIDDEN } from '@/lib/store-policy'

/** Panes about buying, which the App Store build never opens (lib/store-policy). */
const STORE_PANES: SettingsSection[] = ['billing', 'usage']

const SECTIONS: SettingsSection[] = [
  'general',
  'account',
  'calendarSync',
  'moodle',
  'privacy',
  'devices',
  'billing',
  'usage',
]

/**
 * `?settings=billing` opens the panel straight to that pane on load.
 *
 * This exists so notifications can deep-link. A trial-ending push that says
 * "cancel in Billing" and then drops you on Today has told you to go hunting at
 * exactly the moment you're least patient.
 *
 * Read from `window.location` rather than the router: this provider sits above
 * the Router in the tree, so `useSearchParams` isn't available here.
 */
function fromUrl(): SettingsSection | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('settings')
    if (!raw || !SECTIONS.includes(raw as SettingsSection)) return null
    if (PURCHASES_HIDDEN && STORE_PANES.includes(raw as SettingsSection)) return null
    return raw as SettingsSection
  } catch {
    return null
  }
}

/** Owns the floating settings panel's open/section state. App-level so the gear
 * icon, avatar menu, command palette, and paywall CTAs can all open it. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // Initialised from the URL, so the panel is already open on first paint
  // instead of flashing the page behind it.
  const [initial] = useState(fromUrl)
  const [open, setOpen] = useState(initial !== null)
  const [section, setSection] = useState<SettingsSection>(initial ?? 'general')

  // Strip the param once consumed: a reload (or a shared link) shouldn't
  // reopen the panel forever. replaceState, so it costs no history entry.
  useEffect(() => {
    if (initial === null) return
    const url = new URL(window.location.href)
    url.searchParams.delete('settings')
    window.history.replaceState({}, '', url)
  }, [initial])

  const openSettings = useCallback((next?: SettingsSection) => {
    // Every "Upgrade" button in the app calls this with 'billing'. In the App
    // Store build those buttons are already hidden; this is the backstop, so
    // one that was missed does nothing rather than opening a price.
    if (PURCHASES_HIDDEN && next && STORE_PANES.includes(next)) return
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
