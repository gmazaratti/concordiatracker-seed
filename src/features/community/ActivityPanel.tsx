import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, PartyPopper, Rss, UserPlus, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { createPortal } from 'react-dom'
import { Mascot } from '@/components/Mascot'
import { OrgLogo } from './OrgLogo'
import { useCommunity } from './useCommunity'
import { useFollows } from '@/app/providers/follows'
import { acceptFriend, listFriends, removeFriend, type Friend } from '@/lib/social'
import { relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * Notifications, full-screen, from the top right.
 *
 * Where Instagram, X and TikTok all put it, and for the same reason: it is a
 * thing you open, clear and leave, so spending a permanent tab slot on it would
 * be paying rent for a room you visit twice a day.
 *
 * ONE reverse-chronological list rather than sub-tabs. "An org you follow
 * posted", "somebody asked to connect" and "somebody accepted" are different
 * kinds of news but they are the same question — what happened since I last
 * looked — and splitting them means checking three places to answer it.
 */
type Item =
  | { kind: 'event'; id: string; at: number; title: string; orgHandle: string }
  | { kind: 'request'; id: string; at: number; friend: Friend }
  | { kind: 'accepted'; id: string; at: number; friend: Friend }

export function ActivityPanel({ onClose }: { onClose: () => void }) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const { events, orgs } = useCommunity()
  const { isFollowing } = useFollows()
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [tick, setTick] = useState(0)
  // Read once. The clock is impure, and a list that re-derives "how long ago"
  // on every render reorders itself while you are reading it.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    void listFriends().then((r) => alive && setFriends(r))
    return () => {
      alive = false
    }
  }, [tick])

  const items = useMemo(() => {
    const out: Item[] = []

    // Only orgs you follow. An "activity" feed that shows every event on
    // campus is just the events tab with worse sorting.
    for (const e of events) {
      if (!isFollowing(e.org.handle)) continue
      const posted = now - (e.postedDaysAgo ?? 0) * 86_400_000
      out.push({
        kind: 'event',
        id: `ev-${e.id}`,
        at: posted,
        title: e.title,
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

    return out.sort((a, b) => b.at - a.at).slice(0, 60)
  }, [events, isFollowing, friends, now])

  const orgByHandle = useMemo(
    () => new Map(orgs.map((o) => [o.handle, o])),
    [orgs],
  )

  return createPortal(
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Activity"
      className="fixed inset-0 z-[80] flex flex-col bg-canvas"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Bell size={17} className="shrink-0 text-accent" aria-hidden />
        <h2 className="min-w-0 flex-1 font-display text-[17px] font-medium text-fg">Activity</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-9 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg active:scale-95"
        >
          <X size={18} aria-hidden />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-4 py-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Mascot mood="resting" size="sm" soft className="text-accent" />
              <p className="text-[13px] font-medium text-fg">Nothing new</p>
              <p className="max-w-xs text-[12px] leading-relaxed text-subtle">
                Follow a few clubs and their events land here. So do connection requests.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li key={it.id}>
                  {it.kind === 'event' ? (
                    <Link
                      to={`/app/community?event=${it.id.slice(3)}`}
                      onClick={onClose}
                      className="flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent active:scale-[0.99]"
                    >
                      {orgByHandle.get(it.orgHandle) ? (
                        <OrgLogo
                          org={orgByHandle.get(it.orgHandle)!}
                          className="size-9 shrink-0"
                          rounded="rounded-full"
                        />
                      ) : (
                        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2">
                          <PartyPopper size={15} className="text-subtle" aria-hidden />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] text-fg">
                          <span className="font-medium">{it.orgHandle}</span> posted an event
                        </span>
                        <span className="block truncate text-[12px] text-subtle">{it.title}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-subtle">
                        {relativeDueLabel(new Date(it.at).toISOString())}
                      </span>
                    </Link>
                  ) : it.kind === 'request' ? (
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2.5">
                      <UserPlus size={16} className="shrink-0 text-accent" aria-hidden />
                      <Link
                        to={`/@${it.friend.handle}`}
                        onClick={onClose}
                        className="min-w-0 flex-1 text-[13px] text-fg hover:underline"
                      >
                        <span className="font-medium">{it.friend.name ?? it.friend.handle}</span>{' '}
                        wants to connect
                      </Link>
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void acceptFriend(it.friend.friendship_id).then(() =>
                              setTick((n) => n + 1),
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover active:scale-95"
                        >
                          <Check size={12} aria-hidden />
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void removeFriend(it.friend.friendship_id).then(() =>
                              setTick((n) => n + 1),
                            )
                          }
                          className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-150 hover:text-fg active:scale-95"
                        >
                          Ignore
                        </button>
                      </span>
                    </div>
                  ) : (
                    <Link
                      to={`/app/community?c=messages&chat=${it.friend.handle}`}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent active:scale-[0.99]"
                    >
                      <Rss size={16} className="shrink-0 text-subtle" aria-hidden />
                      <span className="min-w-0 flex-1 text-[13px] text-fg">
                        <span className="font-medium">{it.friend.name ?? it.friend.handle}</span>{' '}
                        is connected with you
                      </span>
                      <span className="shrink-0 text-[11px] text-subtle">
                        {relativeDueLabel(new Date(it.at).toISOString())}
                      </span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** The bell, with a dot when there is something to see. Lives in the Community
 *  header on every section, the way it does in the apps this borrows from. */
export function ActivityButton({
  count,
  onOpen,
}: {
  count: number
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={count > 0 ? `Activity, ${count} new` : 'Activity'}
      className={cn(
        'relative grid size-9 place-items-center rounded-full border border-border text-muted',
        'transition-all duration-150 hover:border-accent hover:text-fg active:scale-95',
      )}
    >
      <Bell size={16} aria-hidden />
      {count > 0 && (
        <span
          className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-canvas"
          aria-hidden
        />
      )}
    </button>
  )
}
