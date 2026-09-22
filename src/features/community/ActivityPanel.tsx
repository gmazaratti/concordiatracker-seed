import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowLeft, Bell, MessageSquare, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { Mascot } from '@/components/Mascot'
import { useCommunity } from './useCommunity'
import type { EventOrg } from '@/data/community'
import { acceptFriend, listFriends, type Friend } from '@/lib/social'
import { deleteNotifications, listNotifications, markNotificationsRead } from '@/lib/notifications'
import { dismissActivity, notificationsChanged } from '@/lib/notification-state'
import { SwipeToDelete } from '@/components/SwipeToDelete'
import { useActivityFeed, type ActivityItem } from './useActivityFeed'
import { cn } from '@/lib/cn'

const DAY = 86_400_000
/** Matches ct-panel-right-out. One number, so the CSS and the unmount
 *  cannot drift into a flash of an already-gone panel. */
const EXIT_MS = 200
/** Module level: `react-hooks/purity` bars a clock read in a component body. */
const nowMs = () => Date.now()

type Filter = 'all' | 'follows' | 'comments' | 'clubs'

/**
 * Four pills, the reference's shape.
 *
 * Three of the labels are the reference's own. The fourth is not "Follows",
 * which would say the same thing as "People you follow" on our data, so the
 * slot carries the category we have that it does not: organisations.
 */
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'follows', label: 'People you follow' },
  { id: 'comments', label: 'Comments' },
  { id: 'clubs', label: 'Clubs' },
]

/**
 * Notifications: a sheet down the right edge on desktop, the whole screen on
 * a phone.
 *
 * BUILT TO THE REFERENCE, and the reference is the notification panel every
 * product of this shape ships. What that means concretely, because the last
 * version missed most of it: real faces rather than icon tiles, a sentence
 * whose actor is bold and whose age sits inline at the end of it, day GROUPS
 * with headings, the action for a row sitting on the right of that row, and a
 * thumbnail of the thing when the notification is about a thing. Reading a
 * list like this is pattern-matching, so every row has to be the same shape.
 *
 * ONE DEVIATION, and it is the account switcher: the mobile reference heads
 * the screen with the signed-in username and a caret, which is how you change
 * Instagram account. There is one account here, so the heading says what the
 * screen is instead. Everything else is the reference, in our colours.
 */
export function ActivityPanel({ onClose }: { onClose: () => void }) {
  /*
   * LEAVING IS AN ANIMATION TOO. Opening slid in and closing simply stopped
   * existing, which reads as a fault rather than a dismissal. So `close`
   * marks the panel as leaving, lets the slide run, and unmounts on a TIMER —
   * not on `animationend`, because the global reduced-motion rule zeroes
   * every duration and an event at 0ms is a race the panel would sometimes
   * lose and stay on screen forever.
   */
  const reduced = usePrefersReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const close = () => {
    if (leaving) return
    if (reduced) return onClose()
    setLeaving(true)
    setTimeout(onClose, EXIT_MS)
  }
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(close)
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

  /**
   * OPENING THE PANEL CLEARS IT.
   *
   * It always marked rows read; what it did not do was tell anything else, so
   * the bell kept its count until the next visibility change and the panel
   * looked like it had not registered being opened. `notificationsChanged()`
   * moves the badge and this list on the same frame.
   *
   * The ROWS stay for this viewing — clearing the unread state is not the
   * same as erasing what happened, and a list that empties itself the instant
   * you look at it is one you cannot read.
   */
  useEffect(() => {
    void (async () => {
      const rows = await listNotifications()
      if (rows.some((r) => !r.read_at)) {
        await markNotificationsRead()
        notificationsChanged()
      }
    })()
  }, [])

  /**
   * One row gone, by whichever mechanism owns it.
   *
   * A stored notification is a real row and gets a real delete. Everything
   * else on this list is derived from live state and would be recomputed
   * straight back, so it is remembered as dismissed per device instead. The
   * caller does not need to know which; see notification-state.ts.
   */
  const dismiss = (it: ActivityItem) => {
    if (it.kind === 'stored') void deleteNotifications([it.n.id]).then(notificationsChanged)
    else dismissActivity(it.id)
  }

  const clearAll = () => {
    for (const it of items) if (it.kind !== 'stored') dismissActivity(it.id)
    void deleteNotifications().then(notificationsChanged)
  }

  const orgByHandle = useMemo(() => new Map(orgs.map((o) => [o.handle, o])), [orgs])
  const orgByName = useMemo(() => new Map(orgs.map((o) => [o.name.toLowerCase(), o])), [orgs])

  const shown = items.filter((it) => {
    if (filter === 'all') return true
    if (filter === 'follows') return it.kind === 'request' || it.kind === 'accepted'
    if (filter === 'clubs')
      // Club-to-club news belongs here too: a collab invite is one
      // organisation talking to another, not a reply on a feature request.
      return (
        it.kind === 'event' ||
        (it.kind === 'stored' && (it.n.kind === 'org_post' || it.n.kind.startsWith('collab')))
      )
    return (
      it.kind === 'messages' ||
      (it.kind === 'stored' &&
        it.n.kind !== 'org_post' &&
        it.n.kind !== 'follow' &&
        !it.n.kind.startsWith('collab'))
    )
  })

  const groups = groupByAge(shown, nowMs())

  return createPortal(
    <>
      {/* Desktop only: the sheet does not cover the page, so there has to be
          something to click past it. On a phone it IS the page. */}
      <div
        className={cn(
          'fixed inset-0 z-[79] hidden bg-black/50 md:block',
          leaving && 'ct-scrim-out',
        )}
        onClick={close}
        aria-hidden
      />
      <div
        ref={ref}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        className={cn(
          'fixed z-[80] flex flex-col bg-canvas',
          leaving ? 'ct-panel-right-out' : 'ct-panel-right',
          // Phone: the whole screen. `touch-action` allows the list to scroll
          // and nothing else — a pinch on a notification list only ever
          // happens by accident, and it leaves the page zoomed with no
          // obvious way back.
          'inset-0 h-[100dvh] touch-pan-y',
          // Desktop: anchored to the right edge, its own column.
          'md:inset-y-0 md:left-auto md:h-full md:w-[27rem] md:border-l md:border-border md:shadow-2xl',
        )}
      >
        <header className="shrink-0 pt-[env(safe-area-inset-top)]">
          {/* Phone: back arrow and the title, the way you left a screen you
              pushed onto a stack. */}
          <div className="flex items-center gap-1 px-2 py-2 md:hidden">
            <button
              type="button"
              onClick={close}
              aria-label="Back"
              className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2"
            >
              <ArrowLeft size={22} aria-hidden />
            </button>
            <h2 className="min-w-0 flex-1 text-[17px] font-bold text-fg">Notifications</h2>
            {items.length > 0 && <ClearAll onClear={clearAll} />}
          </div>

          {/* Desktop: the title carries the weight, and the X is the way out. */}
          <div className="hidden items-start justify-between px-6 pt-5 pb-1 md:flex">
            <h2 className="text-[23px] font-bold text-fg">Notifications</h2>
            {items.length > 0 && <ClearAll onClear={clearAll} className="mt-1.5 ml-auto mr-2" />}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="-mt-1 grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <div className="flex gap-2 overflow-x-auto px-3 pb-2 md:px-6 md:pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 md:text-[12.5px]',
                  filter === f.id
                    ? 'bg-fg text-canvas'
                    : 'bg-surface-2 text-fg hover:bg-surface-2/70',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
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
                <h3 className="px-4 pt-4 pb-1 text-[15px] font-bold text-fg md:px-6 md:text-[14px]">
                  {g.label}
                </h3>
                <ul>
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <SwipeToDelete label="this notification" onDelete={() => dismiss(it)}>
                        <Row
                          item={it}
                          orgByHandle={orgByHandle}
                          orgByName={orgByName}
                          onClose={onClose}
                          onActed={() => setTick((n) => n + 1)}
                        />
                      </SwipeToDelete>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </>,
    document.body,
  )
}

/**
 * Clear all, behind one confirmation press.
 *
 * Not a dialog: the cost of being wrong is a list of things you had already
 * read, and a modal for that is heavier than the action. Not bare either —
 * it sits next to the title and a stray tap would empty the screen.
 */
function ClearAll({ onClear, className }: { onClear: () => void; className?: string }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const id = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(id)
  }, [armed])
  return (
    <button
      type="button"
      onClick={() => (armed ? onClear() : setArmed(true))}
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
        armed ? 'bg-danger text-accent-contrast' : 'text-accent hover:bg-surface-2',
        className,
      )}
    >
      {armed ? 'Clear them?' : 'Clear all'}
    </button>
  )
}

/**
 * The reference's groups, which are finer than three buckets.
 *
 * "3h" and "3h" six rows apart mean different things without a heading
 * between them, and Yesterday is its own answer to "when" rather than part of
 * a week.
 */
function groupByAge(items: ActivityItem[], now: number) {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0)
  const buckets: { label: string; items: ActivityItem[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'This week', items: [] },
    { label: 'This month', items: [] },
    { label: 'Earlier', items: [] },
  ]
  for (const it of items) {
    if (it.at >= startOfToday) buckets[0].items.push(it)
    else if (it.at >= startOfToday - DAY) buckets[1].items.push(it)
    else if (it.at >= startOfToday - 7 * DAY) buckets[2].items.push(it)
    else if (it.at >= startOfToday - 30 * DAY) buckets[3].items.push(it)
    else buckets[4].items.push(it)
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

const ROW =
  'flex w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-surface-2/50 md:px-6'

/**
 * One row, and every row is the same shape: a face, one sentence with the age
 * at the end of it, and on the right either the action you would take or a
 * picture of what it is about.
 */
function Row({
  item,
  orgByHandle,
  orgByName,
  onClose,
  onActed,
}: {
  item: ActivityItem
  orgByHandle: Map<string, EventOrg>
  orgByName: Map<string, EventOrg>
  onClose: () => void
  onActed: () => void
}) {
  const age = shortAge(item.at, nowMs())

  if (item.kind === 'request') {
    const who = item.friend.name ?? item.friend.handle
    return (
      <div className={ROW}>
        <Link to={`/@${item.friend.handle}`} onClick={onClose} className="shrink-0">
          <Face src={item.friend.avatar_url} name={who} />
        </Link>
        <Link to={`/@${item.friend.handle}`} onClick={onClose} className="min-w-0 flex-1">
          <Sentence strong={who} rest="started following you." age={age} />
        </Link>
        <Action
          accent
          onClick={() => void acceptFriend(item.friend.handle).then(onActed)}
          label="Follow back"
        />
      </div>
    )
  }

  if (item.kind === 'accepted') {
    const who = item.friend.name ?? item.friend.handle
    return (
      <Link
        to={`/app/community?c=messages&chat=${item.friend.handle}`}
        onClick={onClose}
        className={ROW}
      >
        <Face src={item.friend.avatar_url} name={who} />
        <span className="min-w-0 flex-1">
          <Sentence strong={who} rest="started following you." age={age} />
        </span>
        <Action label="Message" />
      </Link>
    )
  }

  if (item.kind === 'messages') {
    return (
      <Link to="/app/community?c=messages" onClick={onClose} className={ROW}>
        <Face icon={<MessageSquare size={18} className="text-accent" aria-hidden />} />
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
      <Link to={`/app/community?event=${item.id.slice(3)}`} onClick={onClose} className={ROW}>
        <Face src={org?.logo ?? null} name={org?.name ?? item.sub} color={org?.color} />
        <span className="min-w-0 flex-1">
          <Sentence strong={item.sub} rest={`posted ${item.title}`} age={age} />
        </span>
        <Thumb src={org?.banner ?? null} />
      </Link>
    )
  }

  // Stored: a club posted, a request moved, somebody replied.
  const n = item.n
  // The actor's name is what we hold; if it names a club we know, that club's
  // logo is a better face than its initials.
  const who = n.actor_name ?? n.title
  const org = orgByName.get((n.actor_name ?? '').toLowerCase())
  const inner = (
    <>
      <Face
        src={org?.logo ?? null}
        name={who}
        color={org?.color}
        icon={!org && !n.actor_name ? <Bell size={18} className="text-accent" aria-hidden /> : undefined}
      />
      <span className="min-w-0 flex-1">
        <Sentence strong={n.title} rest="" age={age} />
        {n.body && (
          <span className="mt-0.5 block truncate text-[12.5px] text-subtle md:text-[12px]">
            {n.body}
          </span>
        )}
      </span>
      {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
    </>
  )
  return n.link ? (
    <Link to={n.link} onClick={onClose} className={ROW}>
      {inner}
    </Link>
  ) : (
    <div className={ROW}>{inner}</div>
  )
}

/**
 * The face. A real picture wherever we hold one, initials on the club's own
 * colour otherwise, and an icon tile only for the few notifications that have
 * no actor at all.
 */
function Face({
  src,
  name,
  color,
  icon,
}: {
  src?: string | null
  name?: string
  color?: string | null
  icon?: React.ReactNode
}) {
  /*
   * A DEAD IMAGE FALLS BACK, it does not just disappear. Hiding the <img>
   * left a row with a hole where its face should be, which is exactly what
   * happened to the clubs whose logo files are still missing. Tracked in
   * state rather than by mutating the node, so the initials actually render.
   */
  const [failed, setFailed] = useState(false)
  const box = 'size-12 shrink-0 rounded-full md:size-11'
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        className={cn(box, 'object-cover')}
        onError={() => setFailed(true)}
      />
    )
  }
  if (icon) {
    return <span className={cn(box, 'grid place-items-center bg-surface-2')}>{icon}</span>
  }
  return (
    <span
      className={cn(box, 'grid place-items-center text-[13px] font-semibold text-white md:text-[12.5px]')}
      style={{ backgroundColor: color ?? 'var(--ct-surface-2)' }}
    >
      {(name ?? '?').slice(0, 2).toUpperCase()}
    </span>
  )
}

/** The picture of the thing the notification is about, when there is one. */
function Thumb({ src }: { src: string | null }) {
  if (!src) return null
  return (
    <img
      src={src}
      alt=""
      className="size-12 shrink-0 rounded-md object-cover md:size-11"
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

/** The action for this row, on this row. */
function Action({
  label,
  accent,
  onClick,
}: {
  label: string
  accent?: boolean
  onClick?: () => void
}) {
  const cls = cn(
    'shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-150 md:text-[12.5px]',
    accent
      ? 'bg-accent text-accent-contrast hover:bg-accent-hover'
      : 'bg-surface-2 text-fg hover:bg-surface-2/70',
  )
  if (!onClick) return <span className={cls}>{label}</span>
  return (
    <button type="button" onClick={onClick} className={cls}>
      {label}
    </button>
  )
}

/** The bolded actor, the rest of the sentence, then the age — one line that
 *  wraps, with the time inline rather than on its own row. */
function Sentence({ strong, rest, age }: { strong: string; rest: string; age: string }) {
  return (
    <span className="block text-[13.5px] leading-snug text-fg md:text-[13px]">
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
      className="relative grid size-9 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2"
    >
      <Bell size={19} aria-hidden />
      {count > 0 && (
        <span
          className="absolute top-1 right-1 size-2.5 rounded-full bg-danger ring-2 ring-canvas"
          aria-hidden
        />
      )}
    </button>
  )
}
