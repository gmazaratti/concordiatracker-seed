import type { SectionOption } from '@/lib/seats'
import { parseMeetingTimes, type ClassSlot } from '@/features/today/widgets/meeting-times'

/**
 * The arithmetic behind the schedule builder. Pure, so it can be checked
 * without rendering a week grid.
 */

export interface Placed {
  section: SectionOption
  /** The course this section belongs to, e.g. "COMM 223". */
  code: string
  slot: ClassSlot
}

/** Minutes from midnight, for laying a slot onto the grid. */
export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** Every slot of every chosen section, flattened onto the week. */
export function placeSections(chosen: { code: string; section: SectionOption }[]): Placed[] {
  const out: Placed[] = []
  for (const { code, section } of chosen) {
    for (const slot of parseMeetingTimes(section.meetingTimes ?? '')) {
      out.push({ code, section, slot })
    }
  }
  return out
}

export interface Conflict {
  a: Placed
  b: Placed
  day: number
  /** Minutes the two overlap. */
  minutes: number
}

/**
 * Overlapping classes.
 *
 * Touching is not overlapping: a class ending at 11:30 and another starting at
 * 11:30 is a normal back-to-back, and flagging it would cry wolf on half of
 * every realistic timetable. Strict inequality is the whole rule.
 */
export function findConflicts(placed: Placed[]): Conflict[] {
  const out: Conflict[] = []
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i]
      const b = placed[j]
      if (a.slot.day !== b.slot.day) continue
      // Two components of the SAME section cannot clash with each other in any
      // way the student can act on.
      if (a.section.classNumber === b.section.classNumber) continue
      const aStart = toMinutes(a.slot.start)
      const aEnd = toMinutes(a.slot.end)
      const bStart = toMinutes(b.slot.start)
      const bEnd = toMinutes(b.slot.end)
      const overlap = Math.min(aEnd, bEnd) - Math.max(aStart, bStart)
      if (overlap > 0) out.push({ a, b, day: a.slot.day, minutes: overlap })
    }
  }
  return out
}

export interface CampusGap {
  from: Placed
  to: Placed
  day: number
  /** Minutes between the end of one and the start of the next. */
  minutes: number
}

/**
 * Back-to-back classes on different campuses.
 *
 * SGW and Loyola are about 7km apart and the shuttle takes roughly 30 minutes
 * before you have waited for it, so a 20-minute gap between them is a class you
 * will walk into late. Only flagged when both campuses are actually known;
 * guessing from a blank would produce warnings nobody can act on.
 */
export function findCampusGaps(placed: Placed[], minMinutes = 45): CampusGap[] {
  const out: CampusGap[] = []
  const byDay = new Map<number, Placed[]>()
  for (const p of placed) byDay.set(p.slot.day, [...(byDay.get(p.slot.day) ?? []), p])

  for (const [day, items] of byDay) {
    const ordered = [...items].sort((x, y) => toMinutes(x.slot.start) - toMinutes(y.slot.start))
    for (let i = 0; i < ordered.length - 1; i++) {
      const from = ordered[i]
      const to = ordered[i + 1]
      const a = from.section.location?.trim()
      const b = to.section.location?.trim()
      if (!a || !b || a === b) continue
      const gap = toMinutes(to.slot.start) - toMinutes(from.slot.end)
      if (gap >= 0 && gap < minMinutes) out.push({ from, to, day, minutes: gap })
    }
  }
  return out
}

/** The earliest start and latest end across the week, so the grid only draws
 *  hours that contain something. */
export function gridBounds(placed: Placed[]): { start: number; end: number } {
  if (placed.length === 0) return { start: 8 * 60, end: 18 * 60 }
  let start = Infinity
  let end = -Infinity
  for (const p of placed) {
    start = Math.min(start, toMinutes(p.slot.start))
    end = Math.max(end, toMinutes(p.slot.end))
  }
  // Rounded out to whole hours so the row labels read 9, 10, 11 rather than
  // 9:05. No padding beyond that: the grid draws only hours that contain
  // something, and empty rows at the top and bottom are wasted phone screen.
  return { start: Math.floor(start / 60) * 60, end: Math.ceil(end / 60) * 60 }
}

/** Total scheduled hours in the week, for the summary line. */
export function weeklyHours(placed: Placed[]): number {
  const minutes = placed.reduce(
    (sum, p) => sum + (toMinutes(p.slot.end) - toMinutes(p.slot.start)),
    0,
  )
  return Math.round((minutes / 60) * 10) / 10
}

/** Days with nothing on them: the thing everyone actually optimises for. */
export function daysOff(placed: Placed[]): number[] {
  const used = new Set(placed.map((p) => p.slot.day))
  return [1, 2, 3, 4, 5].filter((d) => !used.has(d))
}

/** A time the student has blocked out. Mirrors lib/schedules TimeBlock. */
export interface Block {
  id: string
  day: number
  start: string
  end: string
  label: string
}

/**
 * Does this section run during a time the student has blocked out?
 *
 * Used to grey out sections in the search rather than to hide them. A student
 * who blocked Friday mornings for work may still want to SEE the Friday
 * section and decide for themselves; removing it from the list entirely would
 * look like the course does not exist.
 *
 * A section with no readable meeting time never clashes: "TBA" is unknown, and
 * treating unknown as a clash would hide online and arranged courses, which are
 * exactly the ones that fit around a blocked schedule.
 */
export function clashesWithBlocks(meetingTimes: string | null, blocks: Block[]): Block[] {
  const slots = parseMeetingTimes(meetingTimes ?? '')
  if (slots.length === 0) return []
  const hit: Block[] = []
  for (const b of blocks) {
    const bStart = toMinutes(b.start)
    const bEnd = toMinutes(b.end)
    for (const slot of slots) {
      if (slot.day !== b.day) continue
      const overlap =
        Math.min(toMinutes(slot.end), bEnd) - Math.max(toMinutes(slot.start), bStart)
      // Touching is fine here for the same reason it is between two classes.
      if (overlap > 0 && !hit.includes(b)) hit.push(b)
    }
  }
  return hit
}
