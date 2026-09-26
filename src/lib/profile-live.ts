import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'

/**
 * The signed-in person's own profile row, live (Supabase Realtime).
 *
 * ONE channel per user, shared by everyone who listens (the profile provider,
 * the Pro-gift celebration), and reference-counted so React StrictMode's double
 * mount and several consumers never open duplicate subscriptions. The table is
 * in the `supabase_realtime` publication (db/profile_guard.sql), and Realtime
 * applies RLS: `profile_select_own` means a client is only ever sent its own
 * row, whatever filter it asks for.
 *
 * No polling anywhere: an UPDATE arrives when it happens.
 */
export type ProfileRowPatch = Record<string, unknown>
type Listener = (row: ProfileRowPatch) => void

let current: { userId: string; channel: RealtimeChannel; listeners: Set<Listener> } | null = null

export function onOwnProfileChange(userId: string, listener: Listener): () => void {
  if (current && current.userId !== userId) {
    void supabase.removeChannel(current.channel)
    current = null
  }
  if (!current) {
    const listeners = new Set<Listener>()
    const channel = supabase
      .channel(`profile_${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profile', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as ProfileRowPatch
          for (const l of listeners) l(row)
        },
      )
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
