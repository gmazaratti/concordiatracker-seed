import { useSyncExternalStore } from 'react'
import { buzz } from './message-alerts'

/**
 * The in-app banner that drops in when a message arrives while you are using
 * the app.
 *
 * THE STORE OWNS THE COALESCING, not the component, and that is the whole
 * reason this is a module rather than a `useState` in the banner. The rule is:
 * a second message inside the window must change the TEXT without the banner
 * re-entering or moving. If the component decided that, it would have to
 * distinguish "new alert" from "same alert, new words" on every render, and
 * the first mistake there is a banner that flies in twice in a second.
 *
 * So: `key` stays the same for as long as one banner is open. The component
 * mounts on the first push and simply re-renders on the ones after it, which
 * means the entrance animation is played once by construction — there is no
 * code path that could replay it.
 *
 * THE TIMER IS EXTENDED, NOT RESTARTED FROM THE FIRST MESSAGE. Two seconds
 * from the LATEST one, because a message that arrives at 1.9s would otherwise
 * be shown for a tenth of a second and read as a flicker.
 */

export interface MessageAlert {
  /** Stable for the life of one banner. Changing it is what remounts. */
  key: number
  /** The conversation to open. A user id, or an org id. */
  otherId: string
  otherKind: 'user' | 'org'
  /** Where clicking goes. Null when we could not resolve who it was. */
  handle: string | null
  name: string
  avatar: string | null
  body: string
  /** How many further messages folded into this banner. */
  extra: number
}

const DWELL = 2200

let alert: MessageAlert | null = null
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

/**
 * The conversation on screen, which must never be announced.
 *
 * A banner for a message you are watching arrive is noise, and worse, it
 * covers the top of the thread you are reading. Set by the open chat.
 */
let openThread: string | null = null

export function setOpenThread(id: string | null): void {
  openThread = id
}

function emit() {
  for (const l of listeners) l()
}

export function pushMessageAlert(next: Omit<MessageAlert, 'key' | 'extra'>): void {
  if (openThread && openThread === next.otherId) return

  alert = alert
    ? // Same banner, new words. The key is deliberately carried over.
      { ...next, key: alert.key, extra: alert.extra + 1 }
    : { ...next, key: ++seq, extra: 0 }

  buzz()
  if (timer) clearTimeout(timer)
  timer = setTimeout(dismissMessageAlert, DWELL)
  emit()
}

export function dismissMessageAlert(): void {
  if (timer) clearTimeout(timer)
  timer = undefined
  if (!alert) return
  alert = null
  emit()
}

export function useMessageAlert(): MessageAlert | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => alert,
    () => null,
  )
}
