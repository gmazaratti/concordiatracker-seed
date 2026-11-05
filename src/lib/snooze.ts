/**
 * "Not today": hide an assignment from Today until tomorrow.
 *
 * Stored in `ui_state.snoozed` as { assessmentId: 'YYYY-MM-DD' }, the LOCAL day
 * it comes back. A preference about what Today shows you, so it lives with the
 * other Today preferences and follows you between devices, and the assignment
 * itself (its date, its status) is never touched. Pure: the day is passed in,
 * so it can be checked in Node.
 */
export type SnoozeMap = Record<string, string>

/** Local YYYY-MM-DD for `d`. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function tomorrowKey(today: Date): string {
  const d = new Date(today)
  d.setDate(d.getDate() + 1)
  return dayKey(d)
}

/** Hidden while today is before the day it comes back. */
export function isSnoozed(map: SnoozeMap | undefined, id: string, today: string): boolean {
  const until = map?.[id]
  return !!until && today < until
}

/** Snooze `id` until tomorrow, dropping entries that have already come back so
 *  the map cannot grow forever. */
export function snoozeUntilTomorrow(map: SnoozeMap | undefined, id: string, now: Date): SnoozeMap {
  const today = dayKey(now)
  const next: SnoozeMap = {}
  for (const [k, v] of Object.entries(map ?? {})) if (today < v) next[k] = v
  next[id] = tomorrowKey(now)
  return next
}

/** Bring one back (or all, with no id). */
export function unsnooze(map: SnoozeMap | undefined, id?: string): SnoozeMap {
  if (!id) return {}
  const next = { ...(map ?? {}) }
  delete next[id]
  return next
}
