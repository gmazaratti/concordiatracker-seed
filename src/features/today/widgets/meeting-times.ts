import type { Course } from '@/data/types'

/**
 * Parsing `course.meetingTimes` — pure, and in its own module so the widget file
 * exports only a component (react-refresh/only-export-components), and so this
 * logic can be exercised without rendering anything.
 */

const DAY_TOKENS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
}

export interface ClassSlot {
  day: number
  startMinutes: number
  start: string
  end: string
}

/**
 * Parse "Mon · Wed 10:15–11:30" into slots.
 *
 * Deliberately forgiving and deliberately silent: this string is free text a
 * teacher can edit, so anything unparseable yields no slots rather than a crash
 * or a wrong time. A widget that shows nothing is fine; one that sends you to
 * the wrong room is not.
 */
export function parseMeetingTimes(raw: string | undefined): ClassSlot[] {
  if (!raw?.trim()) return []
  const m = raw.trim().match(/^(.*?)\s+(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/)
  if (!m) return []
  const [, dayPart, start, end] = m

  const toMinutes = (t: string) => {
    const [h, min] = t.split(':').map(Number)
    return h * 60 + min
  }

  return dayPart
    .split(/[·,/]| and /i)
    .map((d) => DAY_TOKENS[d.trim().toLowerCase().slice(0, 5)] ?? DAY_TOKENS[d.trim().toLowerCase().slice(0, 3)])
    .filter((d): d is number => d !== undefined)
    .map((day) => ({ day, startMinutes: toMinutes(start), start, end }))
}

export interface UpcomingClass {
  course: Course
  slot: ClassSlot
  /** Minutes from now until it starts. */
  inMinutes: number
  today: boolean
}

/** The soonest class across every course, searching forward up to a week. */
export function findNextClass(courses: Course[], now: Date): UpcomingClass | null {
  const nowDay = now.getDay()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  let best: UpcomingClass | null = null

  for (const course of courses) {
    for (const slot of parseMeetingTimes(course.meetingTimes)) {
      // How many days ahead this slot next occurs (0 = later today).
      let daysAhead = (slot.day - nowDay + 7) % 7
      if (daysAhead === 0 && slot.startMinutes <= nowMinutes) daysAhead = 7
      const inMinutes = daysAhead * 1440 + slot.startMinutes - nowMinutes
      if (!best || inMinutes < best.inMinutes) {
        best = { course, slot, inMinutes, today: daysAhead === 0 }
      }
    }
  }
  return best
}
