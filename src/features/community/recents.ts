/**
 * What you searched for last, kept on this device.
 *
 * A search screen that opens empty asks you to remember a handle you already
 * looked up once. Recents are the whole reason Instagram's search feels fast:
 * the thing you want is usually the thing you wanted yesterday.
 *
 * Local only, and deliberately so — this is a convenience, not a record. It
 * never leaves the browser, so it costs no privacy surface and needs no table.
 * Every read and write is guarded: a private window can throw on access, and a
 * search box that crashes because storage is disabled would be absurd.
 */
const KEY = 'ct_community_recents'
const MAX = 12

export type RecentKind = 'org' | 'person'

export interface RecentEntry {
  kind: RecentKind
  /** Org handles carry their '@'; person handles do not. Stored verbatim. */
  handle: string
  name: string
  /** People only. Orgs re-read their logo from the live org record. */
  avatar?: string | null
  at: number
}

function isEntry(v: unknown): v is RecentEntry {
  if (!v || typeof v !== 'object') return false
  const e = v as Partial<RecentEntry>
  return (
    (e.kind === 'org' || e.kind === 'person') &&
    typeof e.handle === 'string' &&
    typeof e.name === 'string' &&
    typeof e.at === 'number'
  )
}

export function readRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).sort((a, b) => b.at - a.at).slice(0, MAX)
  } catch {
    return []
  }
}

function write(rows: RecentEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)))
  } catch {
    /* storage disabled — recents are a convenience, not a requirement */
  }
}

/** Opening a result moves it to the top rather than adding a duplicate. */
export function pushRecent(entry: Omit<RecentEntry, 'at'>): RecentEntry[] {
  const rows = readRecents().filter(
    (r) => !(r.kind === entry.kind && r.handle.toLowerCase() === entry.handle.toLowerCase()),
  )
  const next = [{ ...entry, at: Date.now() }, ...rows]
  write(next)
  return next.slice(0, MAX)
}

export function removeRecent(kind: RecentKind, handle: string): RecentEntry[] {
  const next = readRecents().filter(
    (r) => !(r.kind === kind && r.handle.toLowerCase() === handle.toLowerCase()),
  )
  write(next)
  return next
}

export function clearRecents(): RecentEntry[] {
  write([])
  return []
}
