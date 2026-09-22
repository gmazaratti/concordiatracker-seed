import { useSyncExternalStore } from 'react'

/**
 * What happens the moment a message lands while the app is open.
 *
 * DISTINCT FROM `push.ts`, which is the server telling a closed app something
 * happened and needs VAPID keys, a service worker and a stored subscription.
 * This is the page itself reacting to a row arriving over realtime: a buzz, a
 * desktop notification, and a nudge to whatever list is on screen. No server,
 * no subscription, nothing to configure.
 */

const KEY = 'ct_message_alerts'

/* ── The preference ───────────────────────────────────────────────────── */

export function alertsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function setAlertsEnabled(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    /* private mode; the preference is a convenience, not a record */
  }
}

export function canNotify(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifyPermission(): NotificationPermission | 'unsupported' {
  return canNotify() ? Notification.permission : 'unsupported'
}

/** Ask, and only remember the preference if the answer was yes. */
export async function enableAlerts(): Promise<'granted' | 'denied' | 'unsupported'> {
  if (!canNotify()) return 'unsupported'
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (p !== 'granted') return 'denied'
  setAlertsEnabled(true)
  return 'granted'
}

/* ── The alert ────────────────────────────────────────────────────────── */

/**
 * VIBRATION IS ANDROID-ONLY, and saying so matters more than shipping it
 * quietly. `navigator.vibrate` is unimplemented in Safari, which means it
 * does nothing on iPhone — the platform most of this app's users are on. It
 * costs nothing to call and helps the students on Android, so it is called,
 * but nobody should believe the phone buzzes because this line exists.
 */
export function buzz(): void {
  try {
    navigator.vibrate?.(30)
  } catch {
    /* refused by the platform; nothing to do about it */
  }
}

/**
 * The desktop notification for one message.
 *
 * ONLY WHEN YOU ARE NOT LOOKING. A notification for a message you can already
 * see on screen is noise, so this is skipped while the document is visible —
 * the list updating is the notification in that case.
 */
export function notifyMessage(from: string, body: string, onClick?: () => void): void {
  if (!alertsEnabled() || notifyPermission() !== 'granted') return
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') return
  try {
    const n = new Notification(from, {
      body: body.slice(0, 140),
      icon: '/icon-192.png',
      // One notification per sender, replaced rather than stacked: five
      // pings from one conversation is one thing you need to know about.
      tag: `ct-msg-${from}`,
    })
    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
  } catch {
    /* constructor refused (some browsers require a service worker) */
  }
}

/* ── The nudge ────────────────────────────────────────────────────────── */

/**
 * A counter anything can watch to know a message arrived.
 *
 * Module level rather than a provider: the subscription is mounted once on
 * the shell and the lists that care are three components away in different
 * branches of the tree. Threading a context through all of that to carry one
 * integer is more moving parts than the integer is worth.
 */
let tick = 0
const listeners = new Set<() => void>()

export function bumpMessages(): void {
  tick += 1
  for (const l of listeners) l()
}

export function useMessageTick(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => tick,
    () => 0,
  )
}
