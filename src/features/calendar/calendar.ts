import { AlarmClock, Coffee, FileText, Flag, PartyPopper, type LucideIcon } from 'lucide-react'
import type { Assessment, CalendarTask } from '@/data/types'
import type { AcademicEvent, AcademicKind } from '@/data/academic-calendar'
import type { CalendarPrefs } from '@/app/providers/app-data'

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const p2 = (n: number) => String(n).padStart(2, '0')

/** Local `YYYY-MM-DD` key for a Date — the day-bucketing key everywhere. */
export const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

/** Parse a `YYYY-MM-DD` (or ISO) string to a LOCAL date (no UTC shift). */
export function parseDay(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b)
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** The 6×7 (42-cell) grid for the month containing `view`. */
export function monthGrid(view: Date): Date[] {
  const first = startOfMonth(view)
  const start = addDays(first, -first.getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** The 7 days of the week (Sun→Sat) containing `d`. */
export function weekDays(d: Date): Date[] {
  const start = addDays(d, -d.getDay())
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export const ACADEMIC_META: Record<AcademicKind, { label: string; icon: LucideIcon }> = {
  term: { label: 'Term', icon: Flag },
  exam: { label: 'Exams', icon: FileText },
  break: { label: 'Break', icon: Coffee },
  holiday: { label: 'Closed', icon: PartyPopper },
  deadline: { label: 'Deadline', icon: AlarmClock },
}

/** One thing on a given day. */
export type CalendarItem =
  | { kind: 'assessment'; id: string; assessment: Assessment }
  | { kind: 'task'; id: string; task: CalendarTask }
  | { kind: 'academic'; id: string; event: AcademicEvent }

export interface CalendarSource {
  assessments: Assessment[]
  tasks: CalendarTask[]
  academic: AcademicEvent[]
}

function inRange(day: Date, e: AcademicEvent): boolean {
  const key = ymd(day)
  if (!e.end) return key === e.start
  return key >= e.start && key <= e.end
}

/** Everything on `day`, honoring the active layers — assessments + tasks first
 * ("your stuff", by time), then academic events. */
export function dayItems(day: Date, src: CalendarSource, prefs: CalendarPrefs): CalendarItem[] {
  const key = ymd(day)
  const items: CalendarItem[] = []
  if (prefs.showMine) {
    src.assessments
      .filter((a) => ymd(new Date(a.due)) === key)
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
      .forEach((a) => items.push({ kind: 'assessment', id: a.id, assessment: a }))
    src.tasks
      .filter((t) => ymd(new Date(t.due)) === key)
      .forEach((t) => items.push({ kind: 'task', id: t.id, task: t }))
  }
  if (prefs.showConcordia) {
    src.academic
      .filter((e) => inRange(day, e))
      .forEach((e) => items.push({ kind: 'academic', id: e.id, event: e }))
  }
  return items
}

/** Upcoming days (from `from`, inclusive) that have items — for the agenda view. */
export function agendaDays(
  from: Date,
  count: number,
  src: CalendarSource,
  prefs: CalendarPrefs,
): { day: Date; items: CalendarItem[] }[] {
  const out: { day: Date; items: CalendarItem[] }[] = []
  for (let i = 0; i < count; i++) {
    const day = addDays(from, i)
    const items = dayItems(day, src, prefs)
    if (items.length) out.push({ day, items })
  }
  return out
}
