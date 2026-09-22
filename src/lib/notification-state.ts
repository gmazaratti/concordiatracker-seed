import { useSyncExternalStore } from 'react'

/**
 * Two things the notification list needs that the server cannot hold.
 *
 * (1) A TICK, so the bell drops to zero the moment the panel opens rather
 *     than on the next visibility change. The badge is on screen while you
 *     press the thing it counts; waiting for a poll to agree makes the
 *     product look like it did not register the press.
 *
 * (2) A DISMISS LIST for the rows that are DERIVED. Half of what the panel
 *     shows is not a `notifications` row at all — an event an org you follow
 *     posted, a follow request, the unread-message line. Those are computed
 *     from live state every time, so "delete this one" cannot be a delete:
 *     the next render would recompute it straight back. It is remembered here
 *     instead, per device, exactly like `muted-orgs.ts`.
 *
 *     Stored rows are NOT in here. Those get a real `delete_notifications`,
 *     because they are real rows and half-deleting a thing across two
 *     mechanisms is how the two start disagreeing.
 */

const DISMISS_KEY = 'ct_activity_dismissed'
/** Enough that a busy term does not evict something still on screen, small
 *  enough that this never becomes a log. Oldest out first. */
const MAX = 200

const EMPTY: ReadonlySet<string> = new Set()
let ids: Set<string> | null = null
const listeners = new Set<() => void>()
let version = 0

function read(): Set<string> {
  if (ids) return ids
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    const list = raw ? (JSON.parse(raw) as unknown) : []
    ids = new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    // Private mode, cleared storage, a corrupted value: an empty set is a
    // perfectly good answer and nothing here is worth failing a render over.
    ids = new Set()
  }
  return ids
}

function persist(): void {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify([...read()].slice(-MAX)))
  } catch {
    /* a convenience, not a record */
  }
}

function emit(): void {
  version += 1
  for (const fn of listeners) fn()
}

export function isDismissed(id: string): boolean {
  return read().has(id)
}

/**
 * REPLACED, never mutated in place.
 *
 * `useSyncExternalStore` compares snapshots by identity, so a Set that is
 * added to keeps the same reference and nothing re-renders — the row you just
 * swiped away would still be on screen. Every change hands out a new Set.
 */
export function dismissActivity(id: string): void {
  ids = new Set(read()).add(id)
  persist()
  emit()
}

export function undismissActivity(id: string): void {
  const next = new Set(read())
  next.delete(id)
  ids = next
  persist()
  emit()
}

/** Everything again — the undo for "Clear all", within the session. */
export function restoreDismissed(): void {
  ids = new Set()
  persist()
  emit()
}

/** Bumped when anything about the notification set changes: opened, cleared,
 *  a row deleted. Whatever is counting re-reads. */
export function notificationsChanged(): void {
  emit()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useNotificationTick(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => 0,
  )
}

/**
 * The dismissed set, as a value a memo can depend on.
 *
 * The store mutates one Set in place, so handing that out would give React
 * the same reference after every change and nothing would re-render. The
 * version is the snapshot; the Set is rebuilt from it. It also means a
 * consumer's dependency array is honest — it depends on the SET, not on a
 * counter that stands in for one.
 */
export function useDismissed(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => read(), () => EMPTY)
}
