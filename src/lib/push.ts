import { supabase } from './supabase'

/**
 * Client-side Web Push: feature detection, permission + subscription, and the
 * test send. The subscription (endpoint + keys) is stored in `push_subscriptions`
 * (per-user RLS) so the server can target this device. iOS only exposes any of
 * this inside the home-screen-installed PWA (iOS 16.4+).
 */

// Public VAPID key — public by design, but read from env so the keypair lives
// only in your Vercel project (set VITE_VAPID_PUBLIC_KEY there; the private half
// is VAPID_PRIVATE_KEY, server-only). Empty in local dev → enablePush() no-ops.
const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported'
  return Notification.permission
}

/** base64url (VAPID key) → the Uint8Array pushManager.subscribe expects.
 *  Backed by an explicit ArrayBuffer so it satisfies BufferSource. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export type EnableResult = { ok: true } | { ok: false; reason: 'unsupported' | 'denied' | 'error' }

/** Ask permission, subscribe to push, and persist the subscription for this user. */
export async function enablePush(): Promise<EnableResult> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' }

  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'error' } // not configured yet

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  try {
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    }

    const json = sub.toJSON()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, reason: 'error' }

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: navigator.userAgent.slice(0, 300),
      },
      { onConflict: 'endpoint' },
    )
    if (error) return { ok: false, reason: 'error' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Unsubscribe this device and drop its stored subscription. */
export async function disablePush(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
  } catch {
    /* best-effort */
  }
}

/** Ask the server to push a test notification to this user's devices. */
export async function sendTestNotification(): Promise<{ ok: boolean; error?: string }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) return { ok: false, error: 'Please sign in again.' }

  let res: Response
  try {
    res = await fetch('/api/send-push', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch {
    return { ok: false, error: 'Couldn’t reach the server. Check your connection.' }
  }

  if (!res.ok) {
    let msg = 'Could not send the test notification.'
    try {
      const body = (await res.json()) as { error?: string }
      if (body.error) msg = body.error
    } catch {
      if (res.status === 404) msg = 'The notification server only runs on the deployed site.'
    }
    return { ok: false, error: msg }
  }
  return { ok: true }
}
