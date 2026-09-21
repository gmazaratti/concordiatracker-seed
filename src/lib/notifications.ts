import { supabase } from '@/lib/supabase'

/**
 * Stored notifications — the news that cannot be derived.
 *
 * The activity panel works out most of what it shows from state it can
 * already see (events from orgs you follow, pending connection requests).
 * Two things are not like that: a feature request changing status, and
 * somebody replying to one. Both are moments rather than states, and both
 * have to reach people who were involved AT THAT MOMENT — see the reasoning
 * in `db/notifications.sql`.
 */
export interface AppNotification {
  id: string
  kind: 'request_status' | 'request_comment' | string
  title: string
  body: string | null
  link: string | null
  subject_id: string | null
  actor_name: string | null
  read_at: string | null
  created_at: string
}

const COLS = 'id, kind, title, body, link, subject_id, actor_name, read_at, created_at'

/**
 * The most recent 50. Returns [] on any failure — including the 404 you get
 * before the migration has been applied, which must cost the panel its new
 * section and never the whole panel.
 */
export async function listNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(COLS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return (data as AppNotification[] | null) ?? []
}

/** Mark specific ones read, or all of them when no ids are given. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null })
}

export const unreadNotifications = (list: AppNotification[]): number =>
  list.filter((n) => !n.read_at).length
