import { createContext, useContext } from 'react'

/**
 * Follow state — which org handles the student follows.
 *
 * **STUB / CONNECTION-PHASE.** This is in-memory only and resets on reload. Real
 * follow persistence (and the notifications it would drive) needs a multi-user
 * backend — see CLAUDE.md. The whole point of routing every consumer through
 * `useFollows` is that this provider is the SINGLE swap point: re-implement it
 * against Supabase (or any store) and nothing else in the app has to change.
 */
export interface FollowsContextValue {
  /** Handles the user currently follows. */
  followedHandles: string[]
  isFollowing: (handle: string) => boolean
  /** Follow if not followed, unfollow if followed. */
  toggleFollow: (handle: string) => void
}

export const FollowsContext = createContext<FollowsContextValue | null>(null)

export function useFollows(): FollowsContextValue {
  const ctx = useContext(FollowsContext)
  if (!ctx) throw new Error('useFollows must be used within <FollowsProvider>')
  return ctx
}
