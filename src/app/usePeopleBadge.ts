import { useEffect, useState } from 'react'
import { listFriends, unreadCount } from '@/lib/social'
import { listNotifications, unreadNotifications } from '@/lib/notifications'

/**
 * How many things are waiting on you from other people.
 *
 * Unread messages plus new followers you have not followed back, as ONE
 * number: from the sidebar's point of view they are the same fact — somebody
 * is waiting — and two badges on one row is two things to interpret before you
 * have even clicked.
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


/**
 * What the BELL should say — the people badge plus unread notifications.
 *
 * Deliberately a second hook rather than a bigger `usePeopleBadge`. That one
 * also numbers the sidebar's Community item and the Messages pill, and a
 * shipped feature request has nothing to do with either: a count that grows
 * because an admin moved a status would send someone to look for a message
 * that is not there.
 */
export function useActivityBadge(): number {
  const people = usePeopleBadge()
  const [notes, setNotes] = useState(0)

  useEffect(() => {
    let alive = true
    const load = () => {
      void listNotifications().then((rows) => {
        if (alive) setNotes(unreadNotifications(rows))
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

  return people + notes
}
