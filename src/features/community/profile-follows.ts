import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isFollowing, listFriends, requestFriend, unfollowUser } from '@/lib/social'

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
  /** Null on a private profile: the search row leaks no more than the page. */
  program: string | null
  follower_count: number
  /** False means name and picture only, both here and on their profile. */
  is_public?: boolean
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

/**
 * Returns the resulting state (true = now following).
 *
 * THIS USED TO CALL A FUNCTION THAT DOES NOT EXIST. `toggle_profile_follow`
 * and `my_followed_profiles` live in `db/profile_follows.sql`, over a
 * `profile_follows` table — and that migration was never applied: the table is
 * absent from the database entirely, so both RPCs answered 404 and the button
 * did nothing, silently, in production. Found by hooking `fetch` on a real
 * page load rather than by reading the console.
 *
 * The follow graph that IS live is `user_follows`, and `src/lib/social.ts`
 * already speaks it. So this is repointed rather than reimplemented — two
 * implementations of one relationship is how they came to disagree in the
 * first place, and the second one had simply never run.
 */
export async function toggleFollowPerson(handle: string): Promise<boolean> {
  const following = await isFollowing(handle)
  if (following) {
    // `unfollowUser` answers with a boolean; `requestFriend` with a sentence
    // or null. They are not the same shape, so neither is treated as if it is.
    if (!(await unfollowUser(handle))) throw new Error('Could not unfollow that account.')
    return false
  }
  const problem = await requestFriend(handle)
  if (problem) throw new Error(problem)
  return true
}

/**
 * The people the signed-in student follows.
 *
 * `my_friends()` is the follow graph and returns four states; the two that
 * mean "there is a follow row pointing from me at them" are `following` (one
 * way) and `accepted` (they followed back). `pending` is the other direction
 * and `request` is somebody who only wrote to you, so neither belongs here.
 *
 * NO FOLLOWER COUNT. That row does not carry one, and fetching it per person
 * would be one request each for a sidebar list. `PersonRow` already prints the
 * count only when it is above zero, so leaving it at zero omits the line
 * rather than showing a number we did not look up.
 */
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
      const rows = await listFriends()
      if (!active) return
      setPeople(
        rows
          .filter((f) => f.status === 'following' || f.status === 'accepted')
          .map((f) => ({
            handle: f.handle,
            name: f.name,
            avatar_url: f.avatar_url,
            program: f.program,
            follower_count: 0,
          })),
      )
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [tick])

  const reload = useCallback(() => setTick((n) => n + 1), [])
  return { people, loading, reload }
}
