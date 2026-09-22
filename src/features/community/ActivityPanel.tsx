import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell, MessageSquare, PartyPopper, Tag, UserPlus } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { Mascot } from '@/components/Mascot'
import { OrgLogo } from './OrgLogo'
import { useCommunity } from './useCommunity'
import type { EventOrg } from '@/data/community'
import { acceptFriend, listFriends, type Friend } from '@/lib/social'
import { listNotifications, markNotificationsRead } from '@/lib/notifications'
import { useActivityFeed, type ActivityItem } from './useActivityFeed'
import { cn } from '@/lib/cn'

const DAY = 86_400_000
/** Module level: `react-hooks/purity` bars a clock read in a component body. */
const nowMs = () => Date.now()

type Filter = 'all' | 'follows' | 'replies' | 'clubs'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'follows', label: 'People' },
  { id: 'replies', label: 'Replies' },
  { id: 'clubs', label: 'Clubs' },
]

/**
 * Notifications, full screen from the top right.
 *
 * REBUILT TO THE REFERENCE. It used to be one undifferentiated list of bordered
 * cards, which is a dashboard, not a notification screen. What a notification
 * screen is, everywhere that has one: a filter row, day GROUPS ("Today", "Last
 * 7 days"), and borderless rows that are avatar + one sentence + a time, with
 * the action you would take sitting on the right of the row you would take it
 * on. Reading it is pattern-matching, and cards defeat that.
 *
 * THE FILTERS ARE HERE AND THE TABS ARE NOT. Sub-tabs would split "what
 * happened" into three screens you have to visit in turn; a filter narrows the
 * one list you are already looking at and leaves All as the default, which is
 * the question people actually open this with.
 */
export function ActivityPanel({ onClose }: { onClose: () => void }) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const { orgs } = useCommunity()
  const { items } = useActivityFeed()
  const [filter, setFilter] = useState<Filter>('all')
  const [tick, setTick] = useState(0)
  const [friends, setFriends] = useState<Friend[] | null>(null)

  useEffect(() => {
    let alive = true
    void listFriends().then((r) => alive && setFriends(r))
    return () => {
      alive = false
    }
  }, [tick])
  void friends

  /** Opening the panel IS reading them. The dots stay for this viewing. */
  useEffect(() => {
    void (async () => {
      const rows = await listNotifications()
      if (rows.some((r) => !r.read_at)) void markNotificationsRead()
    })()
  }, [])

  const orgByHandle = useMemo(() => new Map(orgs.map((o) => [o.handle, o])), [orgs])

  const shown = items.filter((it) => {
    if (filter === 'all') return true
    if (filter === 'follows') return it.kind === 'request' || it.kind === 'accepted'
    if (filter === 'clubs') return it.kind === 'event' || (it.kind === 'stored' && it.n.kind === 'org_post')
    return it.kind === 'stored' && it.n.kind !== 'org_post' && it.n.kind !== 'follow'
  })

  const groups = groupByAge(shown, nowMs())

  return createPortal(
    <div
      ref={ref}
      onKeyDown={onKeyDown}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label="Notifications"
      className="fixed inset-0 z-[80] flex h-[100dvh] flex-col bg-canvas"
    >
      <header className="shrink-0 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 px-2 py-2">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2"
          >
            <ArrowLeft size={19} aria-hidden />
          </button>
          <h2 className="min-w-0 flex-1 text-center text-[17px] font-semibold text-fg">
            Notifications
          </h2>
          <span className="size-9 shrink-0" />
        </div>

        {/* Pills, the shape that reads as "narrows the list below". */}
        <div className="flex gap-2 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150',
                filter === f.id
                  ? 'bg-fg text-canvas'
                  : 'bg-surface-2 text-fg hover:bg-surface',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-2xl">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-center">
              <Mascot mood="resting" size="sm" soft className="text-accent" />
              <p className="text-[13.5px] font-medium text-fg">Nothing here</p>
              <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
                {filter === 'all'
                  ? 'Follow a few clubs and what they post lands here, along with replies and new followers.'
                  : 'Nothing under this filter yet.'}
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.label}>
                <h3 className="px-4 pt-4 pb-1 text-[15px] font-semibold text-fg">{g.label}</h3>
                <ul>
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <Row
                        item={it}
                        orgByHandle={orgByHandle}
                        onClose={onClose}
                        onActed={() => setTick((n) => n + 1)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Today / Last 7 days / Earlier — the grouping every notification screen
 *  uses, because "3h" and "3h" six rows apart mean different things without
 *  a heading between them. */
function groupByAge(items: ActivityItem[], now: number) {
  const buckets: { label: string; items: ActivityItem[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Last 7 days', items: [] },
    { label: 'Earlier', items: [] },
  ]
  for (const it of items) {
    const age = now - it.at
    if (age < DAY) buckets[0].items.push(it)
    else if (age < 7 * DAY) buckets[1].items.push(it)
    else buckets[2].items.push(it)
  }
  return buckets.filter((b) => b.items.length > 0)
}

/** Relative time in the two characters a notification list uses. */
function shortAge(at: number, now: number): string {
  const d = Math.max(0, now - at)
  if (d < 60_000) return 'now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m`
  if (d < DAY) return `${Math.floor(d / 3_600_000)}h`
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`
  return `${Math.floor(d / (7 * DAY))}w`
}

/**
 * One row: a face, one sentence, a time — and the action on the right.
 *
 * NO BORDER AND NO CARD. The row IS the unit; giving each one an outline makes
 * twenty of them read as twenty separate things to deal with rather than a
 * list to skim.
 */
function Row({
  item,
  orgByHandle,
  onClose,
  onActed,
}: {
  item: ActivityItem
  orgByHandle: Map<string, EventOrg>
  onClose: () => void
  onActed: () => void
}) {
  const age = shortAge(item.at, nowMs())
  const rowCls =
    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2/60'

  if (item.kind === 'request') {
    return (
      <div className={rowCls}>
        <Face><UserPlus size={16} className="text-accent" aria-hidden /></Face>
        <Link to={`/@${item.friend.handle}`} onClick={onClose} className="min-w-0 flex-1">
          <Sentence
            strong={item.friend.name ?? item.friend.handle}
            rest="started following you."
            age={age}
          />
        </Link>
        <button
          type="button"
          onClick={() => void acceptFriend(item.friend.handle).then(onActed)}
          className="shrink-0 rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          Follow back
        </button>
      </div>
    )
  }

  if (item.kind === 'accepted') {
    return (
      <Link
        to={`/app/community?c=messages&chat=${item.friend.handle}`}
        onClick={onClose}
        className={rowCls}
      >
        <Face><UserPlus size={16} className="text-subtle" aria-hidden /></Face>
        <span className="min-w-0 flex-1">
          <Sentence
            strong={item.friend.name ?? item.friend.handle}
            rest="follows you back — you are connected."
            age={age}
          />
        </span>
        <span className="shrink-0 rounded-lg bg-surface-2 px-3.5 py-1.5 text-[12.5px] font-semibold text-fg">
          Message
        </span>
      </Link>
    )
  }

  if (item.kind === 'messages') {
    return (
      <Link to="/app/community?c=messages" onClick={onClose} className={rowCls}>
        <Face><MessageSquare size={16} className="text-accent" aria-hidden /></Face>
        <span className="min-w-0 flex-1">
          <Sentence
            strong={item.count === 1 ? '1 unread message' : `${item.count} unread messages`}
            rest=""
            age={age}
          />
        </span>
      </Link>
    )
  }

  if (item.kind === 'event') {
    const org = orgByHandle.get(item.orgHandle)
    return (
      <Link to={`/app/community?event=${item.id.slice(3)}`} onClick={onClose} className={rowCls}>
        {org ? (
          <OrgLogo
            org={org}
            className="size-11 shrink-0"
            rounded="rounded-full"
          />
        ) : (
          <Face><PartyPopper size={16} className="text-subtle" aria-hidden /></Face>
        )}
        <span className="min-w-0 flex-1">
          <Sentence strong={item.sub} rest={`posted ${item.title}`} age={age} />
        </span>
      </Link>
    )
  }

  // Stored: a club posted, a request moved, somebody replied.
  const n = item.n
  const Icon = n.kind === 'request_comment' ? MessageSquare : n.kind === 'org_post' ? Bell : Tag
  const inner = (
    <>
      <Face unread={!n.read_at}>
        <Icon size={16} className="text-accent" aria-hidden />
      </Face>
      <span className="min-w-0 flex-1">
        <Sentence strong={n.title} rest="" age={age} />
        {n.body && <span className="mt-0.5 block truncate text-[12.5px] text-subtle">{n.body}</span>}
      </span>
      {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </>
  )
  return n.link ? (
    <Link to={n.link} onClick={onClose} className={rowCls}>
      {inner}
    </Link>
  ) : (
    <div className={rowCls}>{inner}</div>
  )
}

function Face({ children, unread }: { children: React.ReactNode; unread?: boolean }) {
  return (
    <span
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full',
        unread ? 'bg-accent-soft' : 'bg-surface-2',
      )}
    >
      {children}
    </span>
  )
}

/** The bolded actor, the rest of the sentence, then the age — one line that
 *  wraps, with the time inline rather than on its own row. */
function Sentence({ strong, rest, age }: { strong: string; rest: string; age: string }) {
  return (
    <span className="block text-[13.5px] leading-snug text-fg">
      <span className="font-semibold">{strong}</span>
      {rest ? ` ${rest}` : ''} <span className="text-subtle">{age}</span>
    </span>
  )
}

/** The bell. Its count is unread notifications plus what is waiting on you. */
export function ActivityButton({ count, onOpen }: { count: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={count > 0 ? `Notifications, ${count} new` : 'Notifications'}
      className="relative grid size-10 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2"
    >
      <Bell size={20} aria-hidden />
      {count > 0 && (
        <span
          className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-danger ring-2 ring-canvas"
          aria-hidden
        />
      )}
    </button>
  )
}
