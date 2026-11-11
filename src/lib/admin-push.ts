import { supabase } from './supabase'

export interface PushResult {
  userId: string
  devices: number
  delivered: number
}

/** Send an admin push (api/admin.ts, push). Throws with the server's sentence. */
export async function sendAdminPush(userIds: string[], title: string, body: string, url: string): Promise<PushResult[]> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  let res: Response
  try {
    res = await fetch('/api/admin?action=push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ userIds, title, body, url }),
    })
  } catch {
    throw new Error('The server did not answer.')
  }
  const json = (await res.json().catch(() => ({}))) as { results?: PushResult[]; error?: string; message?: string }
  if (!res.ok) throw new Error(json.message ?? json.error ?? 'That did not send.')
  return json.results ?? []
}

export interface UserPush {
  devices: { kind: string; user_agent: string | null; created_at: string; apns_env: string | null }[]
  pushes: {
    id: string
    title: string
    body: string | null
    sent_at: string
    delivered: number
    devices: number
    opened_at: string | null
  }[]
}

export async function adminUserPush(userId: string): Promise<UserPush> {
  const { data, error } = await supabase.rpc('admin_user_push', { p_user: userId })
  if (error) throw new Error(error.message)
  return (data ?? { devices: [], pushes: [] }) as UserPush
}

export interface PushStats {
  sent: number
  opened: number
  with_devices: number
  sends: { title: string; at: string; people: number; delivered: number; opened: number }[]
}

export async function adminPushStats(): Promise<PushStats | null> {
  const { data } = await supabase.rpc('admin_push_stats')
  return (data as PushStats | null) ?? null
}

/** "iPhone", "Chrome on Windows", ... from a push subscription. */
export function deviceLabel(d: { kind: string; user_agent: string | null }): string {
  if (d.kind === 'apns') return 'iPhone app'
  const ua = d.user_agent ?? ''
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${browser} on ${os}` : browser
}
