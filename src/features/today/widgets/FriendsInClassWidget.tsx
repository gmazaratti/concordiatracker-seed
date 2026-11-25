import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, Pencil, Users } from 'lucide-react'
import { friendSchedule, listFriends, type Friend, type FriendCourse } from '@/lib/social'
import { useUiState } from '@/app/providers/ui-state'
import { initialsOf } from '@/lib/initials'
import { cn } from '@/lib/cn'
import { WidgetCard, WidgetEmpty } from './WidgetCard'
import { byOrder, statusOf, type FriendStatus } from './friends-status'
import type { WidgetZone } from './registry'

interface Row {
  id: string
  friend: Friend
  classes: FriendCourse[]
}

const MAX_FRIENDS = 20
const DOT: Record<FriendStatus['kind'], string> = {
  class: 'bg-warning',
  free: 'bg-success',
  done: 'bg-success',
  unknown: 'bg-subtle',
}
const ICON_BTN =
  'grid size-7 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent'

/**
 * "Who is in class right now": the people who share their schedule with you.
 * Only people who chose to share appear; the rest are not mentioned, which
 * never says whether they share with anyone. The schedules are read once; the
 * clock re-sorts them every minute without asking the server again.
 *
 * The pencil turns the card into its own editor: move people up and down, hide
 * the ones you do not want on it, and choose whether the list follows your
 * order or puts whoever is in class first. Saved with the rest of your layout.
 */
export function FriendsInClassWidget({ zone = 'rail' }: { zone?: WidgetZone } = {}) {
  const { uiState, patchUiState } = useUiState()
  const prefs = uiState.friendsCard ?? {}
  const [rows, setRows] = useState<Row[] | null>(null)
  const [now, setNow] = useState(() => new Date())
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const friends = (await listFriends()).filter((f) => f.status === 'accepted' && f.handle).slice(0, MAX_FRIENDS)
      const all = await Promise.all(
        friends.map(async (f) => ({ id: f.user_id, friend: f, classes: await friendSchedule(f.handle).catch(() => []) })),
      )
      if (alive) setRows(all.filter((r) => r.classes.length > 0))
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const mine = prefs.sort === 'mine'
  const hidden = useMemo(() => new Set(prefs.hidden ?? []), [prefs.hidden])
  /** Everyone, in your order: what the editor lists. */
  const ordered = useMemo(
    () => byOrder(rows ?? [], prefs.order ?? []).map((r) => ({ ...r, status: statusOf(r.classes, now) })),
    [rows, prefs.order, now],
  )
  const shown = useMemo(() => {
    const list = ordered.filter((r) => !hidden.has(r.id))
    return mine ? list : [...list].sort((a, b) => a.status.sort - b.status.sort)
  }, [ordered, hidden, mine])

  const save = (patch: Partial<NonNullable<typeof uiState.friendsCard>>) => patchUiState({ friendsCard: { ...prefs, ...patch } })
  const move = (i: number, by: -1 | 1) => {
    const ids = ordered.map((r) => r.id)
    const j = i + by
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    // Moving someone means you want your order, so the list follows it.
    save({ order: ids, sort: 'mine' })
  }
  const toggleHidden = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    save({ hidden: [...next] })
  }

  const face = (friend: Friend, status: FriendStatus) => (
    <span className="relative grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
      {friend.avatar_url ? (
        <img src={friend.avatar_url} alt="" className="size-full rounded-full object-cover" />
      ) : (
        initialsOf(friend.name, friend.handle)
      )}
      <span className={cn('absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-surface', DOT[status.kind])} aria-hidden />
    </span>
  )
  const lines = (friend: Friend, status: FriendStatus) => (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-fg">{friend.name ?? `@${friend.handle}`}</span>
      <span className="block truncate text-[11.5px] text-subtle">{status.text}</span>
    </span>
  )

  const canEdit = (rows?.length ?? 0) > 0
  return (
    <WidgetCard
      title="Friends in class"
      icon={Users}
      action={
        canEdit ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            aria-label={editing ? 'Done editing this card' : 'Edit this card'}
            title={editing ? 'Done' : 'Edit this card'}
            className={cn(ICON_BTN, editing && 'bg-accent text-accent-contrast hover:bg-accent hover:text-accent-contrast')}
          >
            {editing ? <Check size={14} aria-hidden /> : <Pencil size={13} aria-hidden />}
          </button>
        ) : undefined
      }
    >
      {rows === null ? (
        <WidgetEmpty>Checking…</WidgetEmpty>
      ) : rows.length === 0 ? (
        <WidgetEmpty>When friends share their schedule with you, you will see who is in class right now.</WidgetEmpty>
      ) : editing ? (
        <div>
          <div className="flex items-center gap-1 border-b border-border/60 px-3 py-2 text-[12px]" role="group" aria-label="Order">
            {(['live', 'mine'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => save({ sort: k })}
                aria-pressed={(mine ? 'mine' : 'live') === k}
                className={cn(
                  'rounded-full px-2.5 py-1 font-medium transition-colors duration-150',
                  (mine ? 'mine' : 'live') === k ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
                )}
              >
                {k === 'live' ? 'In class first' : 'My order'}
              </button>
            ))}
          </div>
          <ul className="divide-y divide-border/60">
            {ordered.map(({ id, friend, status }, i) => {
              const off = hidden.has(id)
              const who = friend.name ?? `@${friend.handle}`
              return (
                <li key={id} className="flex items-center gap-2 py-2 pr-2 pl-3.5">
                  <span className={cn('flex min-w-0 flex-1 items-center gap-2.5', off && 'opacity-45')}>
                    {face(friend, status)}
                    {lines(friend, status)}
                  </span>
                  <button type="button" className={ICON_BTN} disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${who} up`}>
                    <ArrowUp size={14} aria-hidden />
                  </button>
                  <button type="button" className={ICON_BTN} disabled={i === ordered.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${who} down`}>
                    <ArrowDown size={14} aria-hidden />
                  </button>
                  <button type="button" className={ICON_BTN} onClick={() => toggleHidden(id)} aria-pressed={off} aria-label={off ? `Show ${who} on this card` : `Hide ${who} from this card`}>
                    {off ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : shown.length === 0 ? (
        <WidgetEmpty>Everyone is hidden. Use the pencil to bring someone back.</WidgetEmpty>
      ) : (
        <ul className={cn('divide-y divide-border/60', zone === 'wide' && 'sm:grid sm:grid-cols-2 sm:divide-y-0')}>
          {shown.slice(0, zone === 'rail' ? 5 : 8).map(({ id, friend, status }) => (
            <li key={id}>
              <Link to={`/@${friend.handle}`} className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-surface-2/50">
                {face(friend, status)}
                {lines(friend, status)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
