import { useEffect, useState } from 'react'
import { listFriends, unreadCount } from '@/lib/social'

/**
 * How many things are waiting on you from other people.
 *
 * Unread messages plus incoming connection requests, as ONE number: from the
 * sidebar's point of view they are the same fact — somebody is waiting — and
 * two badges on one row is two things to interpret before you have even
 * clicked.
 *
 * Polled on mount and when the tab comes back rather than on a timer. Nothing
 * here is urgent enough to justify waking a background tab, and a message that
 * arrives while you are reading a syllabus can wait until you look up.
 */
export function usePeopleBadge(): number {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let alive = true
    const load = () => {
      void Promise.all([unreadCount(), listFriends()]).then(([unread, friends]) => {
        if (!alive) return
        const incoming = friends.filter(
          (f) => f.status === 'pending' && f.direction === 'incoming',
        ).length
        setCount(unread + incoming)
      })
    }
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return count
}
