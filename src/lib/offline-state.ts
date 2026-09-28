import { useSyncExternalStore } from 'react'

/**
 * Whether the app is showing saved data because the network is gone.
 *
 *   null        — live data (the normal case)
 *   { savedAt } — showing the copy saved at that time (lib/offline-cache)
 *   { savedAt: null } — offline with nothing saved on this device yet
 *
 * A module store rather than context: the data provider sets it, and the shell
 * reads it, and neither should have to thread it through the other.
 */
export type OfflineState = { savedAt: string | null } | null

let state: OfflineState = null
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

export function markOffline(savedAt: string | null): void {
  state = { savedAt }
  emit()
}

export function markLive(): void {
  if (state === null) return
  state = null
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useOfflineState(): OfflineState {
  return useSyncExternalStore(subscribe, () => state, () => null)
}

/* The browser's own online flag, as a hook, so the banner can offer to reload
 * the moment the connection comes back. */
function subscribeOnline(l: () => void) {
  window.addEventListener('online', l)
  window.addEventListener('offline', l)
  return () => {
    window.removeEventListener('online', l)
    window.removeEventListener('offline', l)
  }
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}
