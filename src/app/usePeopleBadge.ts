import { useEffect, useState } from 'react'
import { listFriends, unreadCount } from '@/lib/social'
import { listNotifications, unreadNotifications } from '@/lib/notifications'
import { useMessageTick } from '@/lib/message-alerts'
import { useNotificationTick } from '@/lib/notification-state'

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
 * UNREAD MESSAGES, and nothing else.
 *
 * Deliberately not `usePeopleBadge`, which folds in new followers: this
 * number rides on the Messages icon, and a badge there that counts somebody
 * following you sends a person into their inbox looking for a message that
 * was never sent. It also reacts to `useMessageTick`, so the count moves the
 * instant a message lands rather than on the next visibility change — the
 * badge is on screen while the message arrives, which is the whole point.
 */
export function useUnreadMessages(): number {
  const [count, setCount] = useState(0)
  const live = useMessageTick()

  useEffect(() => {
    let alive = true
    const load = () => {
      void unreadCount().then((n) => alive && setCount(n))
    }
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [live])

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
  /* Opening the panel marks everything read; the badge has to agree with the
     screen on the same frame, not after the next poll. */
  const tick = useNotificationTick()

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
  }, [tick])

  return people + notes
}
