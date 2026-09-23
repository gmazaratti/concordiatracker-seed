/**
 * Writes that fail say so.
 *
 * THE RULE, and the bug that earned it: `fireWrite` logged a failed write to
 * the console and carried on. That is how the audit log spent a day accepting
 * nothing — every `org_activity` insert was refused by RLS, every one printed
 * a line nobody was looking at, and the screen said the save had worked. A
 * save that silently did not happen is worse than an error, because the person
 * walks away believing it.
 *
 * So a fire-and-forget write that fails now raises a toast. Deliberately not a
 * dialog: these are background writes, the work is usually still on screen,
 * and blocking the page for something the person can retry is its own harm.
 * But it is visible, it names what failed, and it does not disappear on its
 * own as fast as a success would.
 *
 * COALESCED BY MESSAGE. A list that re-renders can fire the same refused write
 * twenty times, and twenty identical toasts is a wall rather than a warning.
 */

export interface WriteError {
  /** What was being attempted, in the user's words. */
  what: string
  /** What the database said. Shown small — it is for a bug report, not a fix. */
  detail: string
  at: number
  count: number
}

let current: WriteError | null = null
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setTimeout> | null = null

/** Long enough to read twice. A failed save deserves more than a success. */
const LIFE_MS = 9000

function emit() {
  for (const fn of listeners) fn()
}

export function reportWriteError(what: string, detail: string): void {
  if (current && current.what === what) {
    current = { ...current, count: current.count + 1, at: Date.now() }
  } else {
    current = { what, detail, at: Date.now(), count: 1 }
  }
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    current = null
    emit()
  }, LIFE_MS)
  emit()
}

export function dismissWriteError(): void {
  if (timer) clearTimeout(timer)
  current = null
  emit()
}

export function writeErrorSnapshot(): WriteError | null {
  return current
}

export function subscribeWriteErrors(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/**
 * Turn a PostgREST error into something worth reading.
 *
 * The raw ones are written for whoever wrote the query: "new row violates
 * row-level security policy for table org_activity" tells a student nothing
 * they can act on. The codes that have a human meaning get one; everything
 * else keeps its message, because an unfamiliar error is still better than a
 * made-up explanation.
 */
export function writeErrorText(err: unknown): string {
  const e = err as { code?: string; message?: string } | null
  const code = e?.code ?? ''
  if (code === '42501') return 'You do not have permission to do that.'
  if (code === 'PGRST204' || code === '42703') return 'This app is out of date with the database.'
  if (code === '23505') return 'That already exists.'
  if (code === '23503') return 'Something it refers to no longer exists.'
  return e?.message ?? 'Unknown error'
}
