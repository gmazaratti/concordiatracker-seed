import { useCallback, useMemo, useState } from 'react'
import { CURRENT_VERSION, RELEASES, compareVersions } from '@/data/releases'
import { UpdatesContext } from './updates'

/** Seed "last seen" to the PREVIOUS release so a genuine unseen update is
 * demonstrable on load (the dot + toast fire). Like the rest of the seed this is
 * in-memory and resets on reload. */
const INITIAL_LAST_SEEN = RELEASES[1]?.version ?? '0.0.0'

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const [lastSeenVersion, setLastSeenVersion] = useState(INITIAL_LAST_SEEN)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [toastDismissed, setToastDismissed] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const hasUnseen = compareVersions(CURRENT_VERSION, lastSeenVersion) > 0
  const showIndicator = hasUnseen && notificationsEnabled
  const showToast = showIndicator && !toastDismissed

  const dismissToast = useCallback(() => setToastDismissed(true), [])

  const openHistory = useCallback(() => {
    setIsHistoryOpen(true)
    setLastSeenVersion(CURRENT_VERSION) // viewing clears the dot
    setToastDismissed(true)
  }, [])

  const closeHistory = useCallback(() => setIsHistoryOpen(false), [])

  const value = useMemo(
    () => ({
      currentVersion: CURRENT_VERSION,
      lastSeenVersion,
      hasUnseen,
      notificationsEnabled,
      setNotificationsEnabled,
      showIndicator,
      showToast,
      dismissToast,
      isHistoryOpen,
      openHistory,
      closeHistory,
    }),
    [
      lastSeenVersion,
      hasUnseen,
      notificationsEnabled,
      showIndicator,
      showToast,
      dismissToast,
      isHistoryOpen,
      openHistory,
      closeHistory,
    ],
  )

  return <UpdatesContext value={value}>{children}</UpdatesContext>
}
