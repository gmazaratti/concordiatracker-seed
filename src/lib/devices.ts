import { supabase } from '@/lib/supabase'

/** One place this account is (or was) signed in. From `my_devices()`. */
export interface Device {
  session_id: string
  user_agent: string | null
  ip: string | null
  first_seen: string
  last_active: string
  is_current: boolean
  is_active: boolean
}

export async function listDevices(): Promise<Device[]> {
  const { data, error } = await supabase.rpc('my_devices')
  if (error) throw new Error(error.message)
  return (data ?? []) as Device[]
}

/** End one session. Resolves false when there was nothing to end. */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('revoke_session', { p_session: sessionId })
  if (error) throw new Error(error.message)
  return data === true
}

/** Record the live sessions, so "previously signed in" has something to show
 *  even if the Devices tab is never opened. Best effort. */
export function touchDevices(): void {
  void supabase.rpc('touch_devices').then(
    () => undefined,
    () => undefined,
  )
}

export interface DeviceName {
  /** "Chrome", "Safari", "ConcordiaTracker app"… */
  browser: string
  /** "Windows", "iPhone", "Mac"… */
  os: string
  kind: 'phone' | 'tablet' | 'computer'
}

/**
 * A readable name for a user agent. Deliberately coarse: the point is that
 * someone can recognise their own devices ("Safari on iPhone"), not identify
 * the build. Order matters: Edge and Opera also say "Chrome", Chrome also
 * says "Safari", and iPadOS can claim to be a Mac.
 */
export function describeUserAgent(ua: string | null | undefined): DeviceName {
  const s = ua ?? ''
  const os = /iPhone/.test(s)
    ? 'iPhone'
    : /iPad/.test(s)
      ? 'iPad'
      : /Android/.test(s)
        ? 'Android'
        : /Windows/.test(s)
          ? 'Windows'
          : /Mac OS X|Macintosh/.test(s)
            ? 'Mac'
            : /CrOS/.test(s)
              ? 'ChromeOS'
              : /Linux/.test(s)
                ? 'Linux'
                : 'Unknown device'
  const browser = /Capacitor|ConcordiaTracker/.test(s)
    ? 'ConcordiaTracker app'
    : /Edg\//.test(s)
      ? 'Edge'
      : /OPR\/|Opera/.test(s)
        ? 'Opera'
        : /Firefox\/|FxiOS/.test(s)
          ? 'Firefox'
          : /Chrome\/|CriOS/.test(s)
            ? 'Chrome'
            : /Safari\//.test(s)
              ? 'Safari'
              : 'Browser'
  const kind = os === 'iPhone' || (os === 'Android' && /Mobile/.test(s))
    ? 'phone'
    : os === 'iPad' || os === 'Android'
      ? 'tablet'
      : 'computer'
  return { browser, os, kind }
}
