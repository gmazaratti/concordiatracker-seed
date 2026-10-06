/**
 * The time in the middle of a conversation, like Instagram: shown when the
 * conversation picks up again after a break of an hour or more, and never
 * between the lines of an exchange that is still going.
 *
 *   today            2:58 AM
 *   yesterday        Yesterday 2:58 AM
 *   in the last week Tue 2:58 AM
 *   this year        Oct 2, 2:58 AM
 *   older            Oct 2, 2025, 2:58 AM
 *
 * Pure: the clock is passed in, so a test can ask about any moment.
 */
export const GAP_MS = 60 * 60 * 1000

const dayStart = (t: number) => {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function timeLabel(iso: string, now: number): string {
  const t = new Date(iso).getTime()
  const time = new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const days = Math.round((dayStart(now) - dayStart(t)) / 86_400_000)
  if (days <= 0) return time
  if (days === 1) return `Yesterday ${time}`
  if (days < 7) return `${new Date(t).toLocaleDateString([], { weekday: 'short' })} ${time}`
  const sameYear = new Date(t).getFullYear() === new Date(now).getFullYear()
  return `${new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })}, ${time}`
}

/** The label to draw above this message, or null when it continues the exchange before it. */
export function timeDivider(prevIso: string | null, iso: string, now: number): string | null {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  if (prevIso) {
    const p = new Date(prevIso).getTime()
    if (Number.isFinite(p) && t - p < GAP_MS) return null
  }
  return timeLabel(iso, now)
}
