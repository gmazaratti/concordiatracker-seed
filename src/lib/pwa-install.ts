/*
 * PWA install helpers — platform detection + the Android/Chromium
 * `beforeinstallprompt` capture.
 *
 * Chrome fires `beforeinstallprompt` once per document load when the app is
 * installable. We capture it at module-load time (imported from main.tsx) so we
 * never miss it to a render race, stash it, and let the in-app banner trigger the
 * native prompt on a user gesture. iOS has no such event — installation there is
 * the manual Share → "Add to Home Screen", which the banner explains instead.
 */

/** The non-standard event Chromium fires when the app can be installed. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // suppress Chrome's mini-infobar; we present our own banner
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    emit()
  })
}

export const canPromptInstall = () => deferred !== null

export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Trigger the native Android/Chromium install dialog. Returns true if accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  await deferred.prompt()
  const { outcome } = await deferred.userChoice
  deferred = null
  emit()
  return outcome === 'accepted'
}

/** True when the app is already running as an installed PWA (any platform). */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes this legacy flag instead of display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iOS / iPadOS (incl. iPadOS reporting itself as desktop Safari with touch). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iphone|ipad|ipod/i.test(ua) || iPadOS
}

/** iOS Safari specifically — the only iOS browser that can Add to Home Screen.
 *  (Chrome/Firefox/Edge on iOS are WebKit but can't install.) */
export function isIOSSafari(): boolean {
  if (!isIOS()) return false
  return !/crios|fxios|edgios|opios/i.test(navigator.userAgent)
}
