/** Date helpers. All "today" math is relative to the runtime clock so the
 * seeded demo (overdue / this-week) stays correct whenever it's opened. */

const DAY_MS = 86_400_000

/** Midnight local time for the current day. */
export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

/** ISO timestamp `n` days from now (n may be negative). Used to seed mock data
 * at a fixed wall-clock time of day so labels read naturally. */
export function daysFromNow(n: number, hour = 23, minute = 59): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** Whole calendar days from today to `due` (negative = overdue). */
export function daysUntil(due: string): number {
  const target = new Date(due)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - startOfToday().getTime()) / DAY_MS)
}

/* ── Locale ───────────────────────────────────────────────────────────────────
 * These helpers are pure functions called from ~14 components, so threading a
 * `t` through every call site would be noise. Instead the provider pushes the
 * active language here once, and every formatter below reads it. Module state,
 * not React state — nothing re-renders off it; the language change that sets it
 * already re-renders the tree. */
type DateLang = 'en' | 'fr'
let LANG: DateLang = 'en'

/** Called by <I18nProvider> whenever the interface language changes. */
export function setDateLang(lang: DateLang): void {
  LANG = lang
}

/** The active language, for the other non-component vocabularies (assessment
 * kinds, statuses) that also need to translate without a hook. */
export function activeLang(): DateLang {
  return LANG
}

const LOCALE: Record<DateLang, string> = { en: 'en-US', fr: 'fr-CA' }

/** Formatters are cached per (language × shape) — building one per render is
 * measurably slow on long lists. */
const CACHE = new Map<string, Intl.DateTimeFormat>()
function fmt(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const id = `${LANG}:${key}`
  let f = CACHE.get(id)
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE[LANG], opts)
    CACHE.set(id, f)
  }
  return f
}

/** Compact, human due label: "2 days overdue", "Due today", "Due Fri", "Due Jun 20". */
export function relativeDueLabel(due: string): string {
  const days = daysUntil(due)
  const fr = LANG === 'fr'
  if (days < 0) {
    const n = Math.abs(days)
    if (fr) return n === 1 ? '1 jour de retard' : `${n} jours de retard`
    return n === 1 ? '1 day overdue' : `${n} days overdue`
  }
  if (days === 0) return fr ? 'Dû aujourd’hui' : 'Due today'
  if (days === 1) return fr ? 'Dû demain' : 'Due tomorrow'
  const due2 = fr ? 'Dû' : 'Due'
  if (days < 7) return `${due2} ${fmt('weekday', { weekday: 'short' }).format(new Date(due))}`
  return `${due2} ${fmt('monthDay', { month: 'short', day: 'numeric' }).format(new Date(due))}`
}

/** Where "now" sits within a term: current week, total weeks, and % elapsed
 * (clamped to the term bounds). */
export function termProgress(
  start: string,
  end: string,
): { week: number; totalWeeks: number; percent: number } {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  const now = Date.now()
  const totalWeeks = Math.max(1, Math.round((e - s) / (7 * DAY_MS)))
  const elapsedDays = (now - s) / DAY_MS
  const week = Math.min(totalWeeks, Math.max(1, Math.floor(elapsedDays / 7) + 1))
  const percent = Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100))
  return { week, totalWeeks, percent }
}

/** Full date for tooltips / secondary lines: "Fri, Jun 20". */
export function formatFull(due: string): string {
  return fmt('full', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(due))
}

/** Human due date + time for the editor summary: "Fri, Jun 20 · 11:59 PM". */
export function formatDueDateTime(iso: string): string {
  return fmt('dueDateTime', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** "Jun 20" — the compact month+day used in week ranges. */
export function formatMonthDay(d: Date): string {
  return fmt('monthDay', { month: 'short', day: 'numeric' }).format(d)
}

/** "Friday, Jun 20" — the agenda day header. */
export function formatAgendaDay(d: Date): string {
  return fmt('agendaDay', { weekday: 'long', month: 'short', day: 'numeric' }).format(d)
}

/** "11:59 PM" / "23 h 59" — a bare clock time. */
export function formatTime(d: Date): string {
  return fmt('time', { hour: 'numeric', minute: '2-digit' }).format(d)
}

/** Month names in the active language ("January" / "janvier"). */
export function monthNames(): string[] {
  const f = fmt('month', { month: 'long' })
  return Array.from({ length: 12 }, (_, m) => f.format(new Date(2021, m, 1)))
}

/** Weekday names, Sunday-first, in the active language. `width` picks the shape:
 * 'short' = "Sun" / "dim.", 'narrow' = the single-letter column headers. */
export function weekdayNames(width: 'short' | 'narrow' = 'short'): string[] {
  const f = fmt(`weekday-${width}`, { weekday: width })
  // 2021-08-01 was a Sunday, so this walks Sun→Sat.
  return Array.from({ length: 7 }, (_, i) => f.format(new Date(2021, 7, 1 + i)))
}
