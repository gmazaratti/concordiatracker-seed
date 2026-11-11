import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * Live social changes for the signed-in person (db/realtime_social.sql):
 * somebody followed or unfollowed you, you followed someone (on another
 * device), or somebody shared their schedule with you. Before this, every one
 * of those needed a refresh to show.
 *
 * Same shape as profile-live: ONE channel per user, reference-counted, and
 * Realtime applies each table's select-own policy, so only your own rows ever
 * arrive. Listeners get the table name and re-read what they show.
 */
export type SocialTable = 'user_follows' | 'schedule_grants' | 'notifications'
type Listener = (table: SocialTable) => void

let current: { userId: string; channel: RealtimeChannel; listeners: Set<Listener> } | null = null

export function onSocialChange(userId: string, listener: Listener): () => void {
  if (current && current.userId !== userId) {
    void supabase.removeChannel(current.channel)
    current = null
  }
  if (!current) {
    const listeners = new Set<Listener>()
    const emit = (t: SocialTable) => () => {
      for (const l of listeners) l(t)
    }
    const channel = supabase
      .channel(`social_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows', filter: `following=eq.${userId}` }, emit('user_follows'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_follows', filter: `follower=eq.${userId}` }, emit('user_follows'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_grants', filter: `grantee=eq.${userId}` }, emit('schedule_grants'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, emit('notifications'))
      .subscribe()
    current = { userId, channel, listeners }
  }
  const mine = current
  mine.listeners.add(listener)
  return () => {
    mine.listeners.delete(listener)
    if (mine.listeners.size === 0 && current === mine) {
      void supabase.removeChannel(mine.channel)
      current = null
    }
  }
}
