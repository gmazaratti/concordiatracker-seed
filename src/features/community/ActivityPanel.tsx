import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, Check, MessageSquare, PartyPopper, Rss, Tag, UserPlus, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { createPortal } from 'react-dom'
import { Mascot } from '@/components/Mascot'
import { OrgLogo } from './OrgLogo'
import { useCommunity } from './useCommunity'
import { acceptFriend, listFriends, type Friend } from '@/lib/social'
import { relativeDueLabel } from '@/lib/date'
import { listNotifications, markNotificationsRead } from '@/lib/notifications'
import { useActivityFeed } from './useActivityFeed'
import type { AppNotification as ActivityNotification } from '@/lib/notifications'
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
export function ActivityPanel({ onClose }: { onClose: () => void }) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const { orgs } = useCommunity()
  // ONE assembler, shared with the Today widget. This panel used to build the
  // list itself, which is two places for the same question to be answered
  // differently the first time either gains a source.
  const { items } = useActivityFeed()
  const [tick, setTick] = useState(0)
  const [friends, setFriends] = useState<Friend[] | null>(null)

  useEffect(() => {
    let alive = true
    void listFriends().then((r) => alive && setFriends(r))
    return () => {
      alive = false
    }
  }, [tick])
  // Accepting or declining re-reads the friend list; the feed itself is read
  // once on open, which is what "since I last looked" means.
  void friends

  /**
   * Opening the panel IS reading them. The rows still render from what was
   * loaded, so the unread dots stay visible for this viewing; they are simply
   * not new the next time.
   */
  useEffect(() => {
    void (async () => {
      const rows = await listNotifications()
      if (rows.some((r) => !r.read_at)) void markNotificationsRead()
    })()
  }, [])

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
                  {it.kind === 'stored' ? (
                    <StoredRow n={it.n} onClose={onClose} />
                  ) : it.kind === 'event' ? (
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
                        followed you
                      </Link>
                      <span className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void acceptFriend(it.friend.handle).then(() => setTick((n) => n + 1))
                          }
                          className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[12px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover active:scale-95"
                        >
                          <Check size={12} aria-hidden />
                          Follow back
                        </button>
                      </span>
                    </div>
                  ) : it.kind === 'accepted' ? (
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
                  ) : (
                    <Link
                      to="/app/community?c=messages"
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent active:scale-[0.99]"
                    >
                      <MessageSquare size={16} className="shrink-0 text-accent" aria-hidden />
                      <span className="min-w-0 flex-1 text-[13px] text-fg">
                        {it.count === 1
                          ? '1 unread message'
                          : `${it.count} unread messages`}
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

/**
 * A stored notification: a request you care about moved, or somebody replied.
 *
 * Unread is a dot rather than a background wash. These sit in a list beside
 * events and connection requests, and tinting whole rows would make the panel
 * read as two designs stitched together.
 */
function StoredRow({ n, onClose }: { n: ActivityNotification; onClose: () => void }) {
  const Icon = n.kind === 'request_comment' ? MessageSquare : Tag
  const body = (
    <>
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
        <Icon size={15} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-1.5">
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-fg">{n.title}</span>
          {!n.read_at && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
          )}
        </span>
        {n.body && (
          <span className="mt-0.5 block truncate text-[12px] text-subtle">{n.body}</span>
        )}
        <span className="mt-0.5 block text-[11.5px] text-subtle">
          {relativeDueLabel(n.created_at)}
        </span>
      </span>
    </>
  )

  const cls =
    'flex items-start gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:border-accent active:scale-[0.99]'

  // A notification whose link never made it to the row is still worth reading;
  // it just is not a door.
  return n.link ? (
    <Link to={n.link} onClick={onClose} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
