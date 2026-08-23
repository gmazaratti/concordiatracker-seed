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

/**
 * The label for an assessment whose date is genuinely not known.
 *
 * One string, one place. A syllabus that says "final exam: TBA, scheduled by
 * the registrar" is stating a fact, and the app repeats it rather than making
 * the student invent a deadline to get past a form.
 */
export function tbdLabel(): string {
  return LANG === 'fr' ? 'Date à confirmer' : 'Date not set'
}

/**
 * Sort comparator for anything with a due date.
 *
 * Undated items go LAST, always. They are not urgent — nothing with no date
 * can be — and floating them to the top of a due list would make the one thing
 * you cannot act on the first thing you see.
 */
export function byDue<T extends { due: string | null }>(a: T, b: T): number {
  if (!a.due && !b.due) return 0
  if (!a.due) return 1
  if (!b.due) return -1
  return a.due.localeCompare(b.due)
}

/**
 * Whole calendar days from today to `due` (negative = overdue).
 *
 * An undated item returns Infinity — never overdue, never soon, and last in any
 * ordering, which is exactly how "we do not know when this is" should behave.
 * Note the one thing it does NOT do: `daysUntil(null) >= 0` is true, so any
 * caller using that test to mean "upcoming" must check for a date itself. Every
 * such caller in the codebase does.
 */
export function daysUntil(due: string | null): number {
  if (!due) return Number.POSITIVE_INFINITY
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
export function relativeDueLabel(due: string | null): string {
  // Accepts null so the ~17 call sites do not each grow a branch. An undated
  // item says so wherever it appears, which is the whole point.
  if (!due) return tbdLabel()
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
export function formatFull(due: string | null): string {
  if (!due) return tbdLabel()
  return fmt('full', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(due))
}

/** Human due date + time for the editor summary: "Fri, Jun 20 · 11:59 PM". */
export function formatDueDateTime(iso: string | null): string {
  if (!iso) return tbdLabel()
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
