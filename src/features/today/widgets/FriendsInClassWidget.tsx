import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import { friendSchedule, listFriends, type Friend, type FriendCourse } from '@/lib/social'
import { initialsOf } from '@/lib/initials'
import { cn } from '@/lib/cn'
import { WidgetCard, WidgetEmpty } from './WidgetCard'
import { parseMeetingTimes } from './meeting-times'
import type { WidgetZone } from './registry'

interface Row {
  friend: Friend
  classes: FriendCourse[]
}

const MAX_FRIENDS = 20
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
const fmt = (hhmm: string) => {
  const m = toMin(hhmm)
  const h = Math.floor(m / 60)
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** What a friend is doing right now, from their shared schedule. */
function statusOf(classes: FriendCourse[], now: Date): { inClass: boolean; text: string; sort: number } | null {
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  let next: { start: number; code: string; at: string } | null = null
  for (const c of classes) {
    for (const s of parseMeetingTimes(c.meeting_times ?? undefined)) {
      if (s.day !== day) continue
      const start = toMin(s.start)
      const end = toMin(s.end)
      if (mins >= start && mins < end) {
        return {
          inClass: true,
          text: `In ${c.code} until ${fmt(s.end)}${c.location ? ` · ${c.location}` : ''}`,
          sort: 0,
        }
      }
      if (start > mins && (!next || start < next.start)) next = { start, code: c.code, at: s.start }
    }
  }
  if (next) return { inClass: false, text: `Free until ${fmt(next.at)} (${next.code})`, sort: 1 }
  return { inClass: false, text: 'Done for today', sort: 2 }
}

/**
 * "Who is in class right now": your friends who share their schedule with
 * you, in class first, then free. Only people who chose to share appear; the
 * rest are not mentioned, which never says whether they share with anyone.
 * The schedules are read once; the clock re-sorts them every minute without
 * asking the server again.
 */
export function FriendsInClassWidget({ zone = 'rail' }: { zone?: WidgetZone } = {}) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let alive = true
    void (async () => {
      const friends = (await listFriends()).filter((f) => f.status === 'accepted' && f.handle).slice(0, MAX_FRIENDS)
      const all = await Promise.all(
        friends.map(async (f) => ({ friend: f, classes: await friendSchedule(f.handle).catch(() => []) })),
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

  const shown = useMemo(
    () =>
      (rows ?? [])
        .map((r) => ({ ...r, status: statusOf(r.classes, now) }))
        .filter((r) => r.status)
        .sort((a, b) => a.status!.sort - b.status!.sort),
    [rows, now],
  )

  return (
    <WidgetCard title="Friends in class" icon={Users}>
      {rows === null ? (
        <WidgetEmpty>Checking…</WidgetEmpty>
      ) : shown.length === 0 ? (
        <WidgetEmpty>When friends share their schedule with you, you will see who is in class right now.</WidgetEmpty>
      ) : (
        <ul className={cn('divide-y divide-border/60', zone === 'wide' && 'sm:grid sm:grid-cols-2 sm:divide-y-0')}>
          {shown.slice(0, zone === 'rail' ? 5 : 8).map(({ friend, status }) => (
            <li key={friend.user_id}>
              <Link
                to={`/@${friend.handle}`}
                className="flex items-center gap-2.5 px-3.5 py-2.5 transition-colors duration-150 hover:bg-surface-2/50"
              >
                <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-[11px] font-semibold text-muted">
                  {friend.avatar_url ? (
                    <img src={friend.avatar_url} alt="" className="size-full object-cover" />
                  ) : (
                    initialsOf(friend.name, friend.handle)
                  )}
                  <span
                    className={cn(
                      'absolute right-0 bottom-0 size-2.5 rounded-full ring-2 ring-surface',
                      status!.inClass ? 'bg-warning' : 'bg-success',
                    )}
                    aria-hidden
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-fg">{friend.name ?? `@${friend.handle}`}</span>
                  <span className="block truncate text-[11.5px] text-subtle">{status!.text}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
