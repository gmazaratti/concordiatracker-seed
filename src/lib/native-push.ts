import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabase'
import { requestNavigate } from './native-nav'

/**
 * Push in the App Store app: APNs through @capacitor/push-notifications.
 *
 * The web build's push (lib/push.ts) is a service-worker subscription; the app
 * has no service worker, so here iOS hands us a DEVICE TOKEN instead, and that
 * token goes into the same `push_subscriptions` store as a `kind = 'apns'` row
 * (db/native_push.sql). The server's one sender (api/_push-send.ts) delivers to
 * either kind, so every notification reaches the phone without a second path.
 *
 * The token is written through `register_apns_device`, not a plain upsert: a
 * token belongs to the phone, and when a different account signs in on it the
 * row has to move to them, which RLS rightly will not let a client do directly.
 */

const TOKEN_KEY = 'ct_apns_token'

export const isNativePush = (): boolean => Capacitor.isNativePlatform()

export type NativePermission = 'granted' | 'denied' | 'prompt'

export async function nativePushPermission(): Promise<NativePermission> {
  try {
    const { receive } = await PushNotifications.checkPermissions()
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt'
  } catch {
    return 'denied'
  }
}

function rememberToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* only used to release the token on sign-out; losing it costs nothing now */
  }
}

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

async function saveToken(token: string): Promise<boolean> {
  const { error } = await supabase.rpc('register_apns_device', {
    p_token: token,
    p_user_agent: navigator.userAgent,
  })
  if (error) return false
  rememberToken(token)
  return true
}

/**
 * Ask iOS for a token and store it for the signed-in account.
 *
 * Listeners are attached BEFORE `register()` because iOS can answer
 * immediately, and a token delivered to nobody is a token lost until the next
 * launch.
 */
function registerForToken(): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (v: string | null) => {
      if (done) return
      done = true
      void ok.then((h) => h.remove())
      void bad.then((h) => h.remove())
      resolve(v)
    }
    const ok = PushNotifications.addListener('registration', (t) => finish(t.value))
    const bad = PushNotifications.addListener('registrationError', () => finish(null))
    // No APNs answer within 15s (no network, simulator) means no token.
    window.setTimeout(() => finish(null), 15_000)
    void PushNotifications.register().catch(() => finish(null))
  })
}

export type NativeEnableResult = { ok: true } | { ok: false; reason: 'denied' | 'error' }

/** The "Enable" button: ask permission (once, iOS never asks twice), then register. */
export async function enableNativePush(): Promise<NativeEnableResult> {
  try {
    let perm = await nativePushPermission()
    if (perm === 'prompt') {
      const r = await PushNotifications.requestPermissions()
      perm = r.receive === 'granted' ? 'granted' : 'denied'
    }
    if (perm !== 'granted') return { ok: false, reason: 'denied' }
    const token = await registerForToken()
    if (!token) return { ok: false, reason: 'error' }
    return (await saveToken(token)) ? { ok: true } : { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/**
 * On every launch with permission already granted: re-register. iOS may issue
 * a new token after a restore or an OS update, and the stored one would then
 * silently stop working. Never prompts.
 */
export async function refreshNativePushToken(): Promise<void> {
  if (!isNativePush()) return
  if ((await nativePushPermission()) !== 'granted') return
  const token = await registerForToken()
  if (token) await saveToken(token)
}

/** Sign-out: stop this phone receiving the account's notifications. */
export async function releaseNativePushToken(): Promise<void> {
  if (!isNativePush()) return
  const token = storedToken()
  if (!token) return
  try {
    await supabase.rpc('unregister_apns_device', { p_token: token })
  } catch {
    /* the server prunes it when APNs next says it is gone */
  }
  rememberToken(null)
}

/* ── Taps ────────────────────────────────────────────────────────────────── */

/**
 * A tap on a notification opens the page it is about. Attached at launch
 * (initNative), so a tap that COLD-starts the app is not lost before React
 * mounts: the path waits in the shared navigation queue (lib/native-nav) until
 * the router takes it.
 */
function inAppPath(url: unknown): string | null {
  if (typeof url !== 'string') return null
  return url.startsWith('/') && !url.startsWith('//') ? url : null
}

export function listenForPushTaps(): void {
  if (!isNativePush()) return
  void PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const url = inAppPath((action.notification.data as { url?: unknown } | undefined)?.url)
    if (url) requestNavigate(url)
  })
}
