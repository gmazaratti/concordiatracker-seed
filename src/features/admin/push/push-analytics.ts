import { supabase } from '@/lib/supabase'

/** db/push_analytics.sql → admin_push_analytics. */
export interface PushAnalytics {
  since: string
  reach: { users: number; with_push: number; web: number; iphone: number; devices: number; new_in_period: number }
  totals: { sent: number; delivered: number; opened: number; people_reached: number; median_open_minutes: number | null }
  by_kind: { kind: string; sent: number; delivered: number; opened: number; median_open_minutes: number | null }[]
  daily: { day: string; delivered: number; opened: number }[]
  by_hour: { hour: number; delivered: number; opened: number }[]
  sends: { kind: string; title: string; at: string; people: number; delivered: number; opened: number }[]
  top_openers: { user_id: string; name: string | null; handle: string | null; delivered: number; opened: number }[]
}

export async function loadPushAnalytics(days: number): Promise<PushAnalytics> {
  const { data, error } = await supabase.rpc('admin_push_analytics', { p_days: days })
  if (error) throw new Error(error.message)
  return data as PushAnalytics
}

export const KIND_LABEL: Record<string, string> = {
  admin: 'Sent by you',
  bell: 'Notifications (bell)',
  assignment: 'Deadline reminders',
  reminder: 'Custom reminders',
  seat: 'Seat alerts',
  trial: 'Trial ending',
  admin_alert: 'Your admin alerts',
  test: 'Test pushes',
  other: 'Other',
}

/** "42%", or a dash when nothing was delivered (a rate over zero means nothing). */
export function rate(opened: number, delivered: number): string {
  return delivered > 0 ? `${Math.round((opened / delivered) * 100)}%` : '–'
}

export function minutes(m: number | null): string {
  if (m == null) return '–'
  if (m < 1) return 'under a minute'
  if (m < 60) return `${Math.round(m)} min`
  if (m < 60 * 24) return `${Math.round(m / 60)} h`
  return `${Math.round(m / 1440)} days`
}
