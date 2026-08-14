import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Following PEOPLE — real and persisted, unlike the org-follow stub.
 *
 * Follower counts are shown publicly, and a count that resets on reload is worse
 * than none, so this talks to the database from day one. The follower LIST is
 * deliberately not fetchable: the RPCs return aggregates and your own follows
 * only, so nobody can enumerate the student social graph.
 */

export interface PublicPerson {
  handle: string
  name: string | null
  avatar_url: string | null
  program: string | null
  follower_count: number
}

export async function searchPeople(query: string, limit = 8): Promise<PublicPerson[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase.rpc('search_public_profiles', { p_q: q, p_limit: limit })
  if (error) return []
  return (data ?? []) as PublicPerson[]
}

export interface FollowStats {
  follower_count: number
  following_count: number
  i_follow: boolean
}

export async function followStats(handle: string): Promise<FollowStats | null> {
  const { data, error } = await supabase.rpc('profile_follow_stats', { p_handle: handle })
  if (error) return null
  const row = (Array.isArray(data) ? data[0] : data) as FollowStats | undefined
  return row ?? null
}

/** Returns the resulting state (true = now following). */
export async function toggleFollowPerson(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_profile_follow', { p_handle: handle })
  if (error) throw error
  return data === true
}

/** The people the signed-in student follows. */
export function useFollowedPeople(): {
  people: PublicPerson[]
  loading: boolean
  reload: () => void
} {
  const [people, setPeople] = useState<PublicPerson[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    void (async () => {
      const { data } = await supabase.rpc('my_followed_profiles')
      if (!active) return
      setPeople((data ?? []) as PublicPerson[])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { people, loading, reload }
}
