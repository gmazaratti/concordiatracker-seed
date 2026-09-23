/**
 * What you have already scrolled past.
 *
 * PER DEVICE, IN localStorage, and that is the honest shape rather than a
 * shortcut: "seen" means "it went past my eyes on this screen", which is not
 * a fact about the account. Syncing it would mean a post you read on a laptop
 * is buried on your phone before you have looked at it there, and it would
 * cost a table and a write on every scroll to be wrong in a new way.
 *
 * IT NEVER HIDES ANYTHING. Seen posts move below the line, they do not leave
 * the feed — the complaint that started this was the feed "clearing", and an
 * ordering that removes things is the same bug with better manners.
 *
 * BOUNDED, because this grows forever otherwise. The newest ids are kept and
 * the oldest fall off; a post old enough to have been evicted has long since
 * fallen off the end of the feed too, and the worst case is that it sorts as
 * unseen once.
 */

const KEY = 'ct_seen_feed'
const MAX = 400

let ids: string[] | null = null
const listeners = new Set<() => void>()
let version = 0

function read(): string[] {
  if (ids) return ids
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    ids = Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // A private window, blocked site data, or a corrupted value. An empty
    // list is the right answer to all three: everything reads as unseen,
    // which is the state the feed had before any of this existed.
    ids = []
  }
  return ids
}

function write(next: string[]) {
  ids = next.slice(-MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Kept in memory for this session; nothing here is worth failing over.
  }
  version += 1
  for (const fn of listeners) fn()
}

export function seenIds(): ReadonlySet<string> {
  return new Set(read())
}

export function isSeen(id: string): boolean {
  return read().includes(id)
}

/** Records one item. A repeat is a no-op, so this is safe to call on scroll. */
export function markSeen(id: string): void {
  const list = read()
  if (list.includes(id)) return
  write([...list, id])
}

/** For the tick a component subscribes to. */
export function seenVersion(): number {
  return version
}

export function subscribeSeen(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/* ── Ordering ─────────────────────────────────────────────────────────────── */

export interface Sortable {
  id: string
  /** ISO. What the feed is ordered by within each half. */
  at: string
}

export interface FeedOrder<T extends Sortable> {
  unseen: T[]
  seen: T[]
}

/**
 * Unseen first, newest first, and everything else below the line.
 *
 * TWO LISTS RATHER THAN ONE SORTED LIST, because the divider between them is
 * part of the answer: "you are up to date" is only true at a point, and a
 * single array with a flag on each item makes the renderer find that point
 * itself every time.
 *
 * `seen` is passed in rather than read here so this stays pure and a test can
 * ask what the order would be for any reader.
 */
export function orderFeed<T extends Sortable>(items: T[], seen: ReadonlySet<string>): FeedOrder<T> {
  const newest = (a: T, b: T) => b.at.localeCompare(a.at)
  return {
    unseen: items.filter((i) => !seen.has(i.id)).sort(newest),
    seen: items.filter((i) => seen.has(i.id)).sort(newest),
  }
}
