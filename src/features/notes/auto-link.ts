/**
 * Which class a brand-new note belongs to, from the clock.
 *
 * Writing on Tuesday at 10:05 during FINA 210's Tuesday 10:00–11:15 slot, in
 * week 5 of term, gives "Week 5 FINA 210", linked to that course and week.
 * The student can change or remove the link; this only picks the default.
 *
 * PURE: the time and the term are parameters, so a test can ask about any
 * moment. No import from '@/…' — the Node test reads this file directly.
 *
 * The window opens ten minutes early (people open their notes before the
 * professor starts) and closes fifteen minutes late (the last slide runs over).
 * Two classes at once — a lecture overlapping a section you also added — picks
 * the one that started most recently, since that is the room you walked into.
 */

export interface LinkableCourse {
  id: string
  code: string
  meetingTimes?: string
}

export interface AutoLink {
  courseId: string
  week: number | null
  /** YYYY-MM-DD, the local date of the class. */
  lectureDate: string
  title: string
}

const DAY_TOKENS: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, tues: 2, wed: 3, thu: 4, thur: 4, thurs: 4, fri: 5, sat: 6,
}

interface Slot {
  day: number
  start: number
  end: number
}

const minutes = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** "Mon · Wed 10:15–11:30; Fri 13:00–14:00" → slots. Same grammar as the
 *  Today widget's parser (features/today/widgets/meeting-times.ts). */
export function slotsOf(raw: string | undefined): Slot[] {
  if (!raw?.trim()) return []
  return raw.split(/[;\n]/).flatMap((part) => {
    const m = part.trim().match(/^(.*?)\s+(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})$/)
    if (!m) return []
    const [, days, start, end] = m
    return days
      .split(/[·,/]| and /i)
      .map((d) => DAY_TOKENS[d.trim().toLowerCase().slice(0, 5)] ?? DAY_TOKENS[d.trim().toLowerCase().slice(0, 3)])
      .filter((d): d is number => d !== undefined)
      .map((day) => ({ day, start: minutes(start), end: minutes(end) }))
  })
}

/** Week of term for a moment, or null outside the term. Week 1 starts on the
 *  term's first day. */
export function weekOfTerm(now: Date, termStart: string, termEnd: string): number | null {
  const s = new Date(termStart).getTime()
  const e = new Date(termEnd).getTime()
  const t = now.getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e) || t < s || t > e + 86_400_000) return null
  return Math.floor((t - s) / (7 * 86_400_000)) + 1
}

export function localDate(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

export const EARLY_MINUTES = 10
export const LATE_MINUTES = 15

export function autoLinkFor(
  courses: LinkableCourse[],
  now: Date,
  term: { start: string; end: string },
): AutoLink | null {
  const day = now.getDay()
  const at = now.getHours() * 60 + now.getMinutes()
  let best: { course: LinkableCourse; start: number } | null = null
  for (const course of courses) {
    for (const slot of slotsOf(course.meetingTimes)) {
      if (slot.day !== day) continue
      if (at < slot.start - EARLY_MINUTES || at > slot.end + LATE_MINUTES) continue
      if (!best || slot.start > best.start) best = { course, start: slot.start }
    }
  }
  if (!best) return null
  const week = weekOfTerm(now, term.start, term.end)
  const code = best.course.code.trim()
  return {
    courseId: best.course.id,
    week,
    lectureDate: localDate(now),
    title: week ? `Week ${week} ${code}` : `${code} lecture`,
  }
}
