import { useEffect, useMemo, useState } from 'react'
import { useCommunity } from './useCommunity'
import { useFollows } from '@/app/providers/follows'
import { listFriends, unreadCount, type Friend } from '@/lib/social'
import { listNotifications, type AppNotification } from '@/lib/notifications'
import { useDismissed, useNotificationTick } from '@/lib/notification-state'

/**
 * Everything that counts as "news" for one student, in one order.
 *
 * ONE source for the full-screen panel AND the Today widget. They are two
 * sizes of the same list, and the moment they each assembled it themselves is
 * the moment the widget starts saying 3 while the panel shows 5.
 *
 * DELIBERATELY NOT IN HERE: deadlines. Overdue coursework is the red block at
 * the top of Today, thirty pixels below where this widget sits — repeating it
 * as a notification is the duplicate-surface fault that cost Community two
 * search bars and a second avatar. This list is for what OTHER PEOPLE and the
 * outside world did; your own workload has a screen already.
 */
export type ActivityItem =
  | {
      kind: 'event'
      id: string
      at: number
      title: string
      sub: string
      href: string
      /** Kept so the full panel can still draw the org's logo. */
      orgHandle: string
    }
  | { kind: 'request'; id: string; at: number; friend: Friend }
  | { kind: 'accepted'; id: string; at: number; friend: Friend }
  | { kind: 'stored'; id: string; at: number; n: AppNotification }
  | { kind: 'messages'; id: string; at: number; count: number }

export interface ActivityFeed {
  items: ActivityItem[]
  /** Unread stored notifications — what the bell counts. */
  unread: number
  loading: boolean
}

export function useActivityFeed(): ActivityFeed {
  const { events, orgs } = useCommunity()
  const { isFollowing } = useFollows()
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [stored, setStored] = useState<AppNotification[]>([])
  const [dms, setDms] = useState(0)
  const [loading, setLoading] = useState(true)
  // Read ONCE. The clock is impure, and a list that re-derives "how long ago"
  // on every render reorders itself while you are reading it.
  const [now] = useState(() => Date.now())
  /* Deleting a row, or opening the panel, has to move this list and the bell
     at the same moment — not on the next visibility change. */
  const tick = useNotificationTick()
  const dismissed = useDismissed()

  useEffect(() => {
    let alive = true
    void Promise.all([listFriends(), listNotifications(), unreadCount()]).then(
      ([f, n, u]) => {
        if (!alive) return
        setFriends(f)
        setStored(n)
        setDms(u)
        setLoading(false)
      },
    )
    return () => {
      alive = false
    }
  }, [tick])

  const orgName = useMemo(() => new Map(orgs.map((o) => [o.handle, o.name])), [orgs])

  const items = useMemo(() => {
    const out: ActivityItem[] = []

    // Only orgs you follow. An activity feed carrying every event on campus is
    // the events tab with worse sorting.
    //
    // ONE ROW PER SERIES. A weekly night is thirty dated occurrences in the
    // data, and without this the notification list was six identical lines of
    // "Reggies posted Thirsty Thursdays" — which is one thing that happened,
    // not six.
    const seenSeries = new Set<string>()
    for (const e of events) {
      if (!isFollowing(e.org.handle)) continue
      if (e.seriesId) {
        if (seenSeries.has(e.seriesId)) continue
        seenSeries.add(e.seriesId)
      }
      out.push({
        kind: 'event',
        id: `ev-${e.id}`,
        at: now - (e.postedDaysAgo ?? 0) * 86_400_000,
        title: e.title,
        sub: orgName.get(e.org.handle) ?? e.org.handle,
        href: `/app/community?event=${e.id}`,
        orgHandle: e.org.handle,
      })
    }

    for (const f of friends ?? []) {
      const at = new Date(f.created_at).getTime()
      if (f.status === 'pending' && f.direction === 'incoming') {
        out.push({ kind: 'request', id: `rq-${f.friendship_id}`, at, friend: f })
      } else if (f.status === 'accepted') {
        out.push({ kind: 'accepted', id: `ac-${f.friendship_id}`, at, friend: f })
      }
    }

    /*
     * A FOLLOW ARRIVES TWICE. The database trigger writes a notification for
     * it, and the follow itself shows up in the friend list — and it is the
     * friend row that carries the Follow-back button, so the stored copy is
     * the same sentence with nothing to do about it. The panel was showing
     * both, one under the other.
     *
     * Matched on the actor's name because the trigger leaves subject_id null,
     * and dropped only on a match: an unrecognised follow notification is
     * still shown rather than silently lost.
     */
    const inFriendList = new Set(
      (friends ?? []).map((f) => (f.name ?? f.handle).trim().toLowerCase()),
    )
    for (const n of stored) {
      const dupe =
        n.kind === 'follow' &&
        !!n.actor_name &&
        inFriendList.has(n.actor_name.trim().toLowerCase())
      if (dupe) continue
      out.push({ kind: 'stored', id: `nt-${n.id}`, at: new Date(n.created_at).getTime(), n })
    }

    // ONE row for unread messages, not one per message. The thread list is two
    // taps away and reads better than a notification per line of a
    // conversation you are in the middle of.
    if (dms > 0) out.push({ kind: 'messages', id: 'dm', at: now, count: dms })

    /*
     * DISMISSED ROWS COME OUT HERE, not at the source.
     *
     * A stored notification is deleted for real and never comes back from the
     * server. The rest of this list is DERIVED — an event an org you follow
     * posted, a follow you have not returned — so it is recomputed on every
     * render and "delete" has to mean "remember not to show me this one".
     * Filtering at the end is what makes both kinds behave the same on screen.
     */
    return out.filter((it) => !dismissed.has(it.id)).sort((a, b) => b.at - a.at)
  }, [events, isFollowing, friends, stored, dms, now, orgName, dismissed])

  return { items, unread: stored.filter((n) => !n.read_at).length, loading }
}
