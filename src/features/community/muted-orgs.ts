/**
 * Clubs you have asked not to be suggested.
 *
 * PER DEVICE, in localStorage, and that is a deliberate limit rather than a
 * shortcut. "Stop suggesting this" is a weaker statement than unfollowing or
 * blocking: it is a preference about a feed, not a relationship, and it does
 * not need a row, an RLS policy or a sync story. If it later deserves to
 * follow somebody between devices it moves to `ui_state` — one function to
 * re-point, which is why every read goes through here.
 *
 * Every access is try/caught: private mode, cleared site data and blocked
 * storage all throw, and none of them should cost anybody their feed.
 */
const KEY = 'ct_muted_orgs'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export function mutedOrgs(): Set<string> {
  return new Set(read())
}

export function muteOrg(orgId: string): void {
  try {
    const next = [...new Set([...read(), orgId])].slice(-200)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* a preference we could not save is a preference, not an error */
  }
}

export function unmuteOrg(orgId: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(read().filter((id) => id !== orgId)))
  } catch {
    /* as above */
  }
}
