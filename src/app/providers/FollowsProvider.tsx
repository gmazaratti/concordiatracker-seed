import { useCallback, useMemo, useState } from 'react'
import { FollowsContext, type FollowsContextValue } from './follows'

/** Seed a couple of follows so the pinned bar + notifications are populated on
 * load. In-memory, resets on reload (like the rest of the seed). */
const INITIAL_FOLLOWS = ['@hackconcordia', '@ginacody']

/** The mock follow store. Swap this implementation for a backend later — every
 * consumer reads through `useFollows`, so the rest of the app is untouched. */
export function FollowsProvider({ children }: { children: React.ReactNode }) {
  const [followed, setFollowed] = useState<Set<string>>(() => new Set(INITIAL_FOLLOWS))

  const toggleFollow = useCallback((handle: string) => {
    setFollowed((prev) => {
      const next = new Set(prev)
      if (next.has(handle)) next.delete(handle)
      else next.add(handle)
      return next
    })
  }, [])

  const value = useMemo<FollowsContextValue>(
    () => ({
      followedHandles: [...followed],
      isFollowing: (handle) => followed.has(handle),
      toggleFollow,
    }),
    [followed, toggleFollow],
  )

  return <FollowsContext value={value}>{children}</FollowsContext>
}
