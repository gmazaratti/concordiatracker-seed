/**
 * The decisions behind the offline layer (lib/offline-fetch.ts), kept PURE and
 * import-free so Node can test them (offline-rules.test.mjs).
 *
 * THE LINE THIS FILE DRAWS: a READ may be answered from this device's last copy
 * when there is no network, because showing yesterday's inbox is better than an
 * empty one. A WRITE may be QUEUED only when replaying it later is safe: a
 * table insert/update/delete (idempotent once the row carries its own id) or an
 * RPC on the short list of ones that only mark something seen. Anything else
 * goes to the network or fails loudly. A write answered from a cache would be
 * a save that silently never happened, which is the one thing this app must
 * never do.
 */

/** RPCs that only READ. Safe to answer from the last copy when offline. */
export const READ_RPCS = new Set([
  'am_following',
  'browse_courses',
  'can_see_schedule',
  'can_view_follow_lists',
  'catalog_status',
  'course_tracking',
  'courses_by_codes',
  'dm_receipts_state',
  'event_notify_status',
  'event_repost_state',
  'get_friend_schedule',
  'get_parse_usage',
  'get_public_blueprints',
  'get_public_courses',
  'get_public_profile',
  'have_i_blocked',
  'is_admin',
  'live_stories',
  'my_blocks',
  'my_calendar_feed',
  'my_collab_invites',
  'my_following',
  'my_friends',
  'my_moodle_status',
  'my_org_perms',
  'my_org_unread',
  'my_saved',
  'my_seat_alerts',
  'my_seat_watches',
  'my_subjects',
  'my_thread_with_org',
  'my_threads',
  'my_tickets',
  'notes_feed',
  'org_post_drafts',
  'org_social',
  'org_story_drafts',
  'org_story_reel',
  'org_thread_messages',
  'org_threads',
  'post_comment_list',
  'post_feed',
  'profile_follow_list',
  'profile_follow_stats',
  'profile_social',
  'program_by_any_id',
  'program_course_picks',
  'repost_list',
  'saved_list',
  'seat_watch_limit',
  'section_instructors',
  'thread_receipts',
  'ticket_thread',
  'unlocked_by',
  'user_id_for_handle',
])

/**
 * RPCs whose replay is harmless even if the first attempt did reach the
 * server: each sets a flag to a value rather than flipping it. A toggle
 * (toggle_save, toggle_repost) is deliberately NOT here — replaying a toggle
 * that did land would undo it.
 */
export const QUEUE_RPCS = new Set([
  'ack_seat_alert',
  'ack_seat_alerts',
  'ack_todo_move',
  'mark_notifications_read',
  'mark_org_thread_read',
  'mark_story_seen',
  'mark_thread_read',
])

/**
 * Tables whose inserts get their id (and timestamp) chosen on the device.
 * The optimistic copy on screen and the row that eventually lands then share
 * one id, so an edit made to it while still offline points at the right row,
 * and a replay that already landed answers 409 instead of making a duplicate.
 */
export const INSERT_DEFAULTS: Record<string, { id: boolean; createdAt: boolean }> = {
  messages: { id: true, createdAt: true },
  todos: { id: true, createdAt: true },
  assignments: { id: true, createdAt: false },
}

/**
 * Tables written automatically, never by something the person did: page-view
 * and heartbeat analytics, device bookkeeping. Queuing them offline turned
 * every tab switch into a "change waiting to sync" (build 11 QA). They are
 * never queued: offline, they simply fail, and their callers already ignore
 * that.
 */
export const NEVER_QUEUE = new Set(['site_events', 'analytics_events', 'email_events', 'user_device_history'])

export type RequestClass =
  | { type: 'read' }
  | { type: 'write'; table: string; op: 'insert' | 'update' | 'delete' | 'rpc' }
  | { type: 'pass' }

/** What kind of request this is, from its method and path alone. */
export function classify(method: string, pathname: string): RequestClass {
  const m = method.toUpperCase()
  if (pathname === '/auth/v1/user') return m === 'GET' ? { type: 'read' } : { type: 'pass' }
  if (!pathname.startsWith('/rest/v1/')) return { type: 'pass' }
  const rest = pathname.slice('/rest/v1/'.length)
  if (rest.startsWith('rpc/')) {
    const name = rest.slice(4)
    if (READ_RPCS.has(name) && (m === 'POST' || m === 'GET')) return { type: 'read' }
    if (QUEUE_RPCS.has(name) && m === 'POST') return { type: 'write', table: name, op: 'rpc' }
    return { type: 'pass' }
  }
  const table = rest.split('/')[0]
  if (!table) return { type: 'pass' }
  if (m === 'GET' || m === 'HEAD') return { type: 'read' }
  if (NEVER_QUEUE.has(table)) return { type: 'pass' }
  if (m === 'POST') return { type: 'write', table, op: 'insert' }
  if (m === 'PATCH') return { type: 'write', table, op: 'update' }
  if (m === 'DELETE') return { type: 'write', table, op: 'delete' }
  return { type: 'pass' }
}

/**
 * Whose request this is, from the bearer token's `sub`. Not a security check —
 * the server does that on replay — only a key, so one account's cached inbox
 * is never served to the next person who signs in on the same phone.
 */
export function uidFromAuth(authorization: string | null): string | null {
  if (!authorization) return null
  const token = authorization.replace(/^Bearer\s+/i, '')
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    // atob exists in browsers and in Node 16+, so the tests run it too.
    const json = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
    const sub = (JSON.parse(json) as { sub?: unknown }).sub
    return typeof sub === 'string' && sub ? sub : null
  } catch {
    return null
  }
}

/** The cache key for a read: account + method + full URL + body. */
export function readKey(uid: string, method: string, url: string, body: string | null): string {
  return `${uid}|${method.toUpperCase()}|${url}|${body ?? ''}`
}

/**
 * Give queued inserts their own id and timestamp, so the echo shown now and
 * the row written later agree. Returns the new body and the new URL (the
 * `columns=` parameter postgrest-js adds for array inserts must name the
 * injected keys, or PostgREST drops them).
 */
export function injectInsertDefaults(
  table: string,
  url: string,
  body: string | null,
  makeId: () => string,
  nowIso: string,
): { body: string | null; url: string; rows: Record<string, unknown>[] } {
  let parsed: unknown
  try {
    parsed = body ? JSON.parse(body) : null
  } catch {
    return { body, url, rows: [] }
  }
  const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed] : []
  const rules = INSERT_DEFAULTS[table]
  const added = new Set<string>()
  const rows = (list as Record<string, unknown>[]).map((r) => {
    const row = { ...r }
    if (rules?.id && row.id == null) {
      row.id = makeId()
      added.add('id')
    }
    if (rules?.createdAt && row.created_at == null) {
      row.created_at = nowIso
      added.add('created_at')
    }
    return row
  })
  let nextUrl = url
  if (added.size) {
    try {
      const u = new URL(url)
      const cols = u.searchParams.get('columns')
      if (cols) {
        const have = cols.split(',').map((c) => c.replace(/"/g, ''))
        for (const a of added) if (!have.includes(a)) have.push(a)
        u.searchParams.set('columns', have.map((c) => `"${c}"`).join(','))
        nextUrl = u.toString()
      }
    } catch {
      /* not a URL we can parse: leave it */
    }
  }
  const nextBody = Array.isArray(parsed) ? JSON.stringify(rows) : rows[0] ? JSON.stringify(rows[0]) : body
  return { body: nextBody, url: nextUrl, rows }
}

/**
 * The body a queued write answers with, shaped like PostgREST's own reply so
 * the caller cannot tell the difference: nothing for `return=minimal`, the rows
 * for `return=representation`, one object when the caller asked for a single.
 */
export function syntheticReply(
  op: 'insert' | 'update' | 'delete' | 'rpc',
  prefer: string | null,
  accept: string | null,
  rows: Record<string, unknown>[],
): { status: number; body: string | null } {
  if (op === 'rpc') return { status: 200, body: 'null' }
  const wantsRows = (prefer ?? '').includes('return=representation')
  const single = (accept ?? '').includes('vnd.pgrst.object')
  if (!wantsRows) return { status: op === 'insert' ? 201 : 204, body: null }
  const echo = op === 'delete' ? [] : rows
  if (single) return { status: op === 'insert' ? 201 : 200, body: JSON.stringify(echo[0] ?? null) }
  return { status: op === 'insert' ? 201 : 200, body: JSON.stringify(echo) }
}

/** The rows an update or delete touches by id (`id=eq.<x>`), for the per-row
 *  "waiting to sync" markers. Empty when the filter is anything else. */
export function idsFromFilter(url: string): string[] {
  try {
    const v = new URL(url).searchParams.get('id')
    if (!v) return []
    if (v.startsWith('eq.')) return [v.slice(3)]
    const inList = v.match(/^in\.\((.*)\)$/)
    return inList ? inList[1].split(',').map((s) => s.replace(/"/g, '').trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export type ReplayOutcome = 'done' | 'retry-later' | 'refresh-token' | 'refused'

/** What to do with a queued write after replaying it once. */
export function replayOutcome(status: number, op: 'insert' | 'update' | 'delete' | 'rpc'): ReplayOutcome {
  if (status >= 200 && status < 300) return 'done'
  // A duplicate key on an insert that carries its own id means an earlier
  // attempt already landed. That is success, not a conflict.
  if (status === 409 && op === 'insert') return 'done'
  if (status === 401) return 'refresh-token'
  if (status >= 500 || status === 408 || status === 429) return 'retry-later'
  return 'refused'
}

/**
 * A queued write the person would not recognise as "a change they made":
 * marking something read or seen, or a flag the app sets on its own. It still
 * goes up, in order, but it is not counted in "N changes waiting to sync" —
 * a number that grew while you were only reading was the other half of the
 * build-11 complaint.
 */
export function isSilentWrite(q: { op: string; table: string; body: string | null }): boolean {
  if (q.op === 'rpc') return true
  if (q.op !== 'update' || !q.body) return false
  try {
    const keys = Object.keys(JSON.parse(q.body) as Record<string, unknown>)
    return keys.length > 0 && keys.every((k) => k === 'read_at' || k === 'ui_state')
  } catch {
    return false
  }
}

/** How long to wait before the next replay attempt, by consecutive failure. */
export function retryDelay(failures: number): number {
  const steps = [2_000, 5_000, 10_000, 20_000, 30_000]
  return steps[Math.min(Math.max(failures, 0), steps.length - 1)]
}
