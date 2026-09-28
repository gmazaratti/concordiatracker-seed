import { useSyncExternalStore } from 'react'
import {
  classify,
  idsFromFilter,
  injectInsertDefaults,
  readKey,
  isSilentWrite,
  replayOutcome,
  retryDelay,
  syntheticReply,
  uidFromAuth,
} from './offline-rules'
import { markLive, markOffline } from './offline-state'
import { reportWriteError, writeErrorText } from './write-errors'

/**
 * The app's network layer for Supabase, underneath every query (lib/supabase.ts
 * passes it as the client's `fetch`). Two jobs, both about a phone that loses
 * signal in the metro.
 *
 * READS ARE REMEMBERED. Every successful read (table selects, the read-only
 * RPCs in offline-rules, and the "who am I" call the chat makes) is kept in
 * IndexedDB, per account. With no network the last copy answers instead, so
 * the inbox, your own profile, the feed and events render what they showed last
 * time rather than an empty or "isn't here" screen. A copy served this way
 * carries `statusText = OFFLINE_COPY`, so a caller that must not treat old data
 * as the truth (ui_state) can tell.
 *
 * WRITES ARE QUEUED. A write that cannot reach the server is kept (in order,
 * in localStorage) and answered at once with the reply the server would have
 * given, so the screen updates immediately and no "did not save" appears for
 * something that will save. The queue replays in order the moment the
 * connection returns. Only writes that are safe to replay are queued (see
 * offline-rules); everything else still goes to the network and fails loudly.
 * A queued write the server later REFUSES is reported then, because by then it
 * genuinely did not save.
 *
 * While anything is queued, new writes queue behind it rather than jumping
 * ahead: marking done offline and then undone online must end undone.
 */

/** statusText on a response that came from this device, not the server. */
export const OFFLINE_COPY = 'Offline copy'

const QUEUE_KEY = 'ct_offline_queue'
/** The last account seen on this device, for requests made while offline
 *  after its token expired (they carry only the public key, no user). */
const UID_KEY = 'ct_offline_uid'
const DB_NAME = 'ct-offline'
const STORE = 'reads'
const MAX_READS = 400
const MAX_BODY = 512 * 1024

export interface QueuedWrite {
  id: string
  uid: string
  table: string
  op: 'insert' | 'update' | 'delete' | 'rpc'
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  /** The rows as they will land (inserts), for "Sending…" in the chat. */
  rows: Record<string, unknown>[]
  /** Row ids an update/delete touches, for per-row "waiting" markers. */
  ids: string[]
  at: string
}

/* ── The queue ─────────────────────────────────────────────────────────── */

let queue: QueuedWrite[] = loadQueue()
const listeners = new Set<() => void>()

function loadQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    const parsed = raw ? (JSON.parse(raw) as QueuedWrite[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveQueue() {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    /* storage full: the queue still works for this session */
  }
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Everything still waiting to reach the server, oldest first. */
export function usePendingWrites(): QueuedWrite[] {
  return useSyncExternalStore(subscribe, () => queue, () => queue)
}

/** Ids of rows in `table` with a change still waiting. */
export function pendingIdsIn(list: QueuedWrite[], table: string): Set<string> {
  const out = new Set<string>()
  for (const q of list) {
    if (q.table !== table) continue
    for (const id of q.ids) out.add(id)
    for (const r of q.rows) if (typeof r.id === 'string') out.add(r.id)
  }
  return out
}

/** Forget everything on sign-out: a shared phone must not replay the last
 *  person's writes under the next person's account. */
export async function clearOfflineStore(): Promise<void> {
  queue = []
  saveQueue()
  try {
    localStorage.removeItem(UID_KEY)
  } catch {
    /* nothing stored */
  }
  try {
    const db = await openDb()
    if (!db) return
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => res()
      tx.onerror = () => res()
    })
  } catch {
    /* nothing stored */
  }
}

/* ── The read cache (IndexedDB) ────────────────────────────────────────── */

interface CachedRead {
  key: string
  status: number
  contentType: string | null
  contentRange: string | null
  body: string | null
  savedAt: string
}

let dbPromise: Promise<IDBDatabase | null> | null = null

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'key' })
        store.createIndex('savedAt', 'savedAt')
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return dbPromise
}

async function getRead(key: string): Promise<CachedRead | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      req.onsuccess = () => resolve((req.result as CachedRead | undefined) ?? null)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

let writesSincePrune = 0

async function putRead(entry: CachedRead): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    writesSincePrune += 1
    if (writesSincePrune >= 50) {
      writesSincePrune = 0
      prune(db)
    }
  } catch {
    /* quota: fine, the app still works online */
  }
}

/** Keep the newest MAX_READS copies; drop the oldest beyond that. */
function prune(db: IDBDatabase) {
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const countReq = store.count()
    countReq.onsuccess = () => {
      let extra = countReq.result - MAX_READS
      if (extra <= 0) return
      const cursor = store.index('savedAt').openCursor()
      cursor.onsuccess = () => {
        const c = cursor.result
        if (!c || extra <= 0) return
        c.delete()
        extra -= 1
        c.continue()
      }
    }
  } catch {
    /* next time */
  }
}

function fromCache(c: CachedRead, method: string): Response {
  const headers = new Headers()
  if (c.contentType) headers.set('Content-Type', c.contentType)
  if (c.contentRange) headers.set('Content-Range', c.contentRange)
  return new Response(method === 'HEAD' ? null : c.body, {
    status: c.status,
    statusText: OFFLINE_COPY,
    headers,
  })
}

/* ── The fetch ─────────────────────────────────────────────────────────── */

let baseFetch: typeof fetch = (...a) => fetch(...a)
let tokenProvider: (refresh?: boolean) => Promise<string | null> = async () => null

/** lib/supabase.ts hands over the current session's token for replays, which
 *  must go out under the token of NOW, not the one that was current offline. */
export function setTokenProvider(fn: (refresh?: boolean) => Promise<string | null>) {
  tokenProvider = fn
}

function isNetworkFailure(e: unknown): boolean {
  // fetch rejects with TypeError when the network is unreachable ("Load
  // failed" on WebKit, "Failed to fetch" on Chromium). An abort is NOT one.
  return e instanceof TypeError
}

function rememberUid(uid: string) {
  try {
    if (localStorage.getItem(UID_KEY) !== uid) localStorage.setItem(UID_KEY, uid)
  } catch {
    /* storage blocked */
  }
}

/** The account this device last made a signed-in request as, or null. */
export function rememberedUid(): string | null {
  return lastUid()
}

function lastUid(): string | null {
  try {
    return localStorage.getItem(UID_KEY)
  } catch {
    return null
  }
}

function offlineNow(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

function headerRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  h.forEach((v, k) => {
    // Never persist the bearer token: replays use the session of the moment.
    if (k.toLowerCase() !== 'authorization') out[k] = v
  })
  return out
}

export function createOfflineFetch(base: typeof fetch, supabaseUrl: string): typeof fetch {
  baseFetch = base
  let origin = ''
  try {
    origin = new URL(supabaseUrl).origin
  } catch {
    /* no URL configured: pass everything through */
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!origin || input instanceof Request) return base(input, init)
    const url = typeof input === 'string' ? input : input.toString()
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return base(input, init)
    }
    if (parsed.origin !== origin) return base(input, init)

    const method = (init?.method ?? 'GET').toUpperCase()
    const kind = classify(method, parsed.pathname)
    if (kind.type === 'pass') return base(input, init)

    const headers = new Headers(init?.headers)
    const tokenUid = uidFromAuth(headers.get('authorization'))
    if (tokenUid) rememberUid(tokenUid)
    /*
     * With no user in the token, this is either a signed-out visitor or a
     * signed-in one whose token expired while offline (renewing it needs the
     * network, so the client falls back to the public key). Only the second
     * can reach saved data, and only when the network is actually gone:
     * sign-out clears the remembered account along with everything saved.
     */
    const offlineUid = tokenUid ? null : lastUid()
    const uid = tokenUid ?? (offlineNow() ? offlineUid : null)
    const body = typeof init?.body === 'string' ? init.body : null

    if (kind.type === 'read') {
      if (!uid) {
        if (!offlineUid) return base(input, init)
        try {
          return await base(input, init)
        } catch (e) {
          if (!isNetworkFailure(e)) throw e
          const c = await getRead(readKey(offlineUid, method, url, body))
          if (!c) throw e
          markOffline(c.savedAt)
          return fromCache(c, method)
        }
      }
      const key = readKey(uid, method, url, body)
      if (offlineNow()) {
        const c = await getRead(key)
        if (c) {
          markOffline(c.savedAt)
          return fromCache(c, method)
        }
        throw new TypeError('Load failed')
      }
      try {
        const res = await base(input, init)
        markLive()
        networkProven()
        if (res.ok) {
          const copy = res.clone()
          void copy.text().then((text) => {
            if (text.length > MAX_BODY) return
            void putRead({
              key,
              status: res.status,
              contentType: res.headers.get('content-type'),
              contentRange: res.headers.get('content-range'),
              body: text,
              savedAt: new Date().toISOString(),
            })
          })
        }
        return res
      } catch (e) {
        if (!isNetworkFailure(e)) throw e
        const c = await getRead(key)
        if (!c) throw e
        markOffline(c.savedAt)
        return fromCache(c, method)
      }
    }

    // A write. Needs an account to replay under; a signed-out write passes,
    // unless it failed for want of a network under a remembered account.
    if (!uid) {
      if (!offlineUid) return base(input, init)
      try {
        return await base(input, init)
      } catch (e) {
        if (!isNetworkFailure(e)) throw e
        return enqueue(offlineUid, kind.table, kind.op, url, method, headers, body)
      }
    }
    const queueFirst = offlineNow() || queue.some((q) => q.uid === uid)
    if (!queueFirst) {
      try {
        return await base(input, init)
      } catch (e) {
        if (!isNetworkFailure(e)) throw e
        // Fall through: the network is gone, keep it for later.
      }
    }
    return enqueue(uid, kind.table, kind.op, url, method, headers, body)
  }
}

function enqueue(
  uid: string,
  table: string,
  op: QueuedWrite['op'],
  url: string,
  method: string,
  headers: Headers,
  body: string | null,
): Response {
  let finalUrl = url
  let finalBody = body
  let rows: Record<string, unknown>[] = []
  if (op === 'insert') {
    const made = injectInsertDefaults(table, url, body, () => crypto.randomUUID(), new Date().toISOString())
    finalUrl = made.url
    finalBody = made.body
    rows = made.rows
  } else if (op === 'update' && body) {
    try {
      const patch = JSON.parse(body) as Record<string, unknown>
      rows = idsFromFilter(url).map((id) => ({ ...patch, id }))
      if (!rows.length) rows = [patch]
    } catch {
      rows = []
    }
  }
  // THE SAME CHANGE TWICE IS ONE CHANGE. Opening a chat marks it read; opening
  // it three times offline must not queue three writes (and read "3 changes
  // waiting" for nothing). An update to the same rows merges into the queued
  // one, as long as nothing later in the queue touches that table (so order
  // is never changed); an identical flag-setting RPC is simply not added again.
  if (op === 'update' || op === 'rpc') {
    let at = -1
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i]
      if (q.uid !== uid || q.table !== table) continue
      if (q.op === op && q.method === method && q.url === finalUrl) at = i
      break
    }
    if (at >= 0) {
      const prev = queue[at]
      if (op === 'rpc') {
        if (prev.body === finalBody) {
          const reply = syntheticReply(op, headers.get('prefer'), headers.get('accept'), rows)
          return new Response(reply.body, { status: reply.status })
        }
      } else {
        try {
          const merged = { ...(JSON.parse(prev.body ?? '{}') as object), ...(JSON.parse(finalBody ?? '{}') as object) }
          const body = JSON.stringify(merged)
          queue = queue.map((q, i) =>
            i === at ? { ...q, body, rows: q.ids.length ? q.ids.map((id) => ({ ...merged, id })) : [merged] } : q,
          )
          saveQueue()
          scheduleFlush()
          const reply = syntheticReply(op, headers.get('prefer'), headers.get('accept'), rows)
          return new Response(reply.body, {
            status: reply.status,
            headers: reply.body !== null ? { 'Content-Type': 'application/json; charset=utf-8' } : {},
          })
        } catch {
          /* not JSON: queue it separately below */
        }
      }
    }
  }
  queue = [
    ...queue,
    {
      id: crypto.randomUUID(),
      uid,
      table,
      op,
      url: finalUrl,
      method,
      headers: headerRecord(headers),
      body: finalBody,
      rows,
      ids: op === 'update' || op === 'delete' ? idsFromFilter(url) : [],
      at: new Date().toISOString(),
    },
  ]
  saveQueue()
  scheduleFlush()
  const reply = syntheticReply(op, headers.get('prefer'), headers.get('accept'), rows)
  return new Response(reply.body, {
    status: reply.status,
    headers: reply.body !== null ? { 'Content-Type': 'application/json; charset=utf-8' } : {},
  })
}

/* ── Replay ────────────────────────────────────────────────────────────── */

let flushing: Promise<void> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
/** Consecutive failed attempts, for the backoff (offline-rules retryDelay). */
let failures = 0
/** A replayed request that has not answered in this long is treated as a
 *  dead connection, not a slow one: after airplane mode iOS can hand back a
 *  socket that died with the radio, and a fetch on it hangs for a minute or
 *  more — which is what left build 11 "Syncing…" until the app was restarted. */
const REPLAY_TIMEOUT_MS = 12_000

function scheduleFlush(delay = 0) {
  if (retryTimer) clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    retryTimer = null
    void flushQueue()
  }, delay)
}

function retryLater() {
  failures += 1
  scheduleFlush(retryDelay(failures))
}

/** Anything that proves the network is back (a real read answered) nudges
 *  the queue, rather than waiting for an `online` event WKWebView may have
 *  delivered before the connection was actually usable. */
function networkProven() {
  if (!queue.length || flushing) return
  failures = 0
  scheduleFlush(0)
}

const TABLE_WORDS: Record<string, string> = {
  messages: 'A message could not be sent',
  assignments: 'An assignment change did not save',
  todos: 'A task change did not save',
  courses: 'A course change did not save',
  user_profile: 'A profile change did not save',
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((res) => setTimeout(() => res(null), ms))])
}

/** Replay everything queued, oldest first. On any sign the network is not
 *  really back yet it stops and tries again on a short backoff — it never just
 *  gives up, which is the bug that needed a restart to sync. Safe to call any
 *  time; concurrent calls share one run. */
export function flushQueue(): Promise<void> {
  if (flushing) return flushing
  flushing = (async () => {
    let synced = 0
    let counted = 0
    try {
      if (queue.length === 0) return
      if (offlineNow()) return // the `online` event starts us again
      let token = await withTimeout(tokenProvider(), 8_000)
      const me = token ? uidFromAuth(`Bearer ${token}`) : null
      if (!me) {
        // No session yet (a token renewal that needs this very connection).
        retryLater()
        return
      }
      while (true) {
        const next = queue.find((q) => q.uid === me)
        if (!next) break
        const send = (t: string) =>
          baseFetch(next.url, {
            method: next.method,
            headers: { ...next.headers, Authorization: `Bearer ${t}` },
            body: next.body ?? undefined,
            signal: AbortSignal.timeout(REPLAY_TIMEOUT_MS),
          })
        let res: Response
        try {
          res = await send(token!)
          if (replayOutcome(res.status, next.op) === 'refresh-token') {
            token = await withTimeout(tokenProvider(true), 8_000)
            if (!token) {
              retryLater()
              return
            }
            res = await send(token)
          }
        } catch {
          // A network failure or the timeout: not back yet.
          retryLater()
          return
        }
        const outcome = replayOutcome(res.status, next.op)
        if (outcome === 'retry-later' || outcome === 'refresh-token') {
          retryLater()
          return
        }
        failures = 0
        // The server answered: whatever the banner said about being offline
        // is no longer true.
        markLive()
        if (outcome === 'refused') {
          const detail = await res.text().catch(() => '')
          let parsed: unknown = detail
          try {
            parsed = JSON.parse(detail)
          } catch {
            /* plain text */
          }
          reportWriteError(TABLE_WORDS[next.table] ?? 'A change did not save', writeErrorText(parsed))
        }
        queue = queue.filter((q) => q.id !== next.id)
        saveQueue()
        synced += 1
        if (!isSilentWrite(next)) counted += 1
      }
    } finally {
      flushing = null
      if (synced > 0 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ct:offline-synced', { detail: { count: synced, changes: counted } }))
      }
    }
  })()
  return flushing
}

/** How many queued writes are real changes (what the banner counts). */
export function usePendingChangeCount(): number {
  const list = usePendingWrites()
  let n = 0
  for (const q of list) if (!isSilentWrite(q)) n += 1
  return n
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    failures = 0
    scheduleFlush(500)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && queue.length) scheduleFlush(300)
  })
  if (queue.length) scheduleFlush(1500)
}
