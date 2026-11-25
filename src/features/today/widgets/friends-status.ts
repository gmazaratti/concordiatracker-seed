import type { FriendCourse } from '@/lib/social'
import { parseMeetingTimes } from './meeting-times'

export interface FriendStatus {
  /** class = in one now, free = has one later today, done = none left today,
   *  unknown = they share their classes but none has a time on it. */
  kind: 'class' | 'free' | 'done' | 'unknown'
  text: string
  sort: number
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}
const fmt = (hhmm: string) => {
  const m = toMin(hhmm)
  const h = Math.floor(m / 60)
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * What a friend is doing right now, from their shared schedule.
 *
 * Someone whose classes carry no times is NOT "done for today": we do not know
 * when they are in class, so the line names their classes and says so.
 */
export function statusOf(classes: FriendCourse[], now: Date): FriendStatus {
  const day = now.getDay()
  const mins = now.getHours() * 60 + now.getMinutes()
  let timed = 0
  let next: { start: number; code: string; at: string } | null = null
  for (const c of classes) {
    const slots = parseMeetingTimes(c.meeting_times ?? undefined)
    timed += slots.length
    for (const s of slots) {
      if (s.day !== day) continue
      const start = toMin(s.start)
      const end = toMin(s.end)
      if (mins >= start && mins < end) {
        return { kind: 'class', text: `In ${c.code} until ${fmt(s.end)}${c.location ? ` · ${c.location}` : ''}`, sort: 0 }
      }
      if (start > mins && (!next || start < next.start)) next = { start, code: c.code, at: s.start }
    }
  }
  if (next) return { kind: 'free', text: `Free until ${fmt(next.at)} (${next.code})`, sort: 1 }
  if (timed === 0) {
    const codes = classes.map((c) => c.code).filter(Boolean)
    return { kind: 'unknown', text: `${codes.slice(0, 3).join(', ')}${codes.length > 3 ? ` +${codes.length - 3}` : ''} · no class times yet`, sort: 3 }
  }
  return { kind: 'done', text: 'Done for today', sort: 2 }
}

/** Put rows in the saved order; anyone not in it keeps their place after. */
export function byOrder<T extends { id: string }>(rows: T[], order: string[]): T[] {
  const at = new Map(order.map((id, i) => [id, i]))
  return rows
    .map((r, i) => ({ r, k: at.has(r.id) ? at.get(r.id)! : order.length + i }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.r)
}
