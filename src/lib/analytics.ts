import { supabase } from './supabase'
import { isNative } from './native'

/**
 * First-party, anonymous traffic tracking. No cookies, no third-party script, no
 * IP or user-agent storage, no cross-site identifiers — just enough to answer
 * "how many people are here, and where did they come from".
 *
 * Two random ids, both generated in this browser:
 *   • visitor_id (localStorage)   — new vs returning
 *   • session_id (sessionStorage) — "online right now"
 * Neither carries personal data, and neither leaves this origin.
 */

const VID_KEY = 'ct_vid'
const SID_KEY = 'ct_sid'
/** Heartbeat cadence — keeps "live now" honest for someone reading one page. */
const PING_MS = 60_000
/** No input for this long and the tab stops counting as in use. */
const IDLE_MS = 5 * 60_000
/** Ignore repeat views of the same path inside this window (StrictMode, bounces). */
const DEDUPE_MS = 2_000
const LAST_VIEW_KEY = 'ct_last_view'

function rid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}

function stored(key: string, store: Storage): string {
  try {
    const existing = store.getItem(key)
    if (existing) return existing
    const fresh = rid()
    store.setItem(key, fresh)
    return fresh
  } catch {
    // Private mode / storage blocked → ephemeral id, still anonymous.
    return rid()
  }
}

/**
 * Turn a real path into a ROUTE SHAPE before it ever leaves the browser.
 *
 * This is a privacy control, not tidiness: invite links look like
 * `/join/casa-x7k2m9` and `/organizer/invite/oiv_f30…`. Logging raw paths would
 * write single-use invite secrets into the analytics table. Anything that looks
 * like a token, uuid, or id becomes a placeholder.
 */
export function normalizePath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    const seg = parts[i]
    const prev = parts[i - 1]
    // Any segment following an invite-ish route is a secret — never record it.
    if (prev === 'join' || prev === 'invite') {
      out.push(':token')
      continue
    }
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || // uuid
      /^\d+$/.test(seg) || // numeric id
      (seg.length > 18 && !seg.includes('-')) || // long opaque blob
      /^(oiv|inv|tok)_/i.test(seg) // known token prefixes
    ) {
      out.push(':id')
      continue
    }
    out.push(seg)
  }
  return '/' + out.join('/')
}

/** Host only — a full referrer URL can carry personal data in its query string. */
function referrerHost(): string | null {
  try {
    if (!document.referrer) return null
    const url = new URL(document.referrer)
    if (url.hostname === window.location.hostname) return null // internal nav
    return url.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

interface Campaign {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
}

/** Campaign tags, remembered for the session so they survive in-app navigation. */
function campaign(): Campaign {
  const CAMPAIGN_KEY = 'ct_utm'
  try {
    const q = new URLSearchParams(window.location.search)
    const fresh: Campaign = {}
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign'] as const) {
      const v = q.get(k)
      if (v) fresh[k] = v.slice(0, 40)
    }
    if (Object.keys(fresh).length) {
      sessionStorage.setItem(CAMPAIGN_KEY, JSON.stringify(fresh))
      return fresh
    }
    const saved = sessionStorage.getItem(CAMPAIGN_KEY)
    return saved ? (JSON.parse(saved) as Campaign) : {}
  } catch {
    return {}
  }
}

const isMobile = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

let lastPath = ''
let lastAt = 0

/*
 * ONLY THE REAL SITE COUNTS. The dev server and every preview points at the
 * production database, so a morning of `npm run dev` reloads — and every
 * throwaway test account — used to land in the same table the dashboard
 * reads, as page views from somebody who does not exist.
 */
const COUNTS =
  import.meta.env.PROD &&
  typeof location !== 'undefined' &&
  // The native shell ALSO serves from localhost — and that is real traffic.
  (isNative() || !/^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname))

async function send(kind: 'view' | 'ping', path: string): Promise<void> {
  if (!COUNTS) return
  try {
    const { data } = await supabase.auth.getSession()
    await supabase.from('site_events').insert({
      session_id: stored(SID_KEY, sessionStorage),
      visitor_id: stored(VID_KEY, localStorage),
      user_id: data.session?.user?.id ?? null,
      kind,
      path,
      referrer_host: kind === 'view' ? referrerHost() : null,
      ...(kind === 'view' ? campaign() : {}),
      device: isMobile() ? 'mobile' : 'desktop',
    })
  } catch {
    /* analytics must never break the app */
  }
}

/** Record a page view (deduped against StrictMode double-mounts). */
export function trackView(pathname: string): void {
  const path = normalizePath(pathname)
  const now = Date.now()
  /*
   * THE LAST VIEW SURVIVES A RELOAD. Held only in memory, the dedupe reset on
   * every page load — so a page that reloaded itself (an auth return, a
   * service-worker update, somebody mashing refresh) recorded one view per
   * load, 0.7s apart. That is the "/app ×6 in five seconds" pattern in
   * site_events. Kept in sessionStorage, the same path inside the window is
   * one view however many times the document starts over.
   */
  let prev = { p: lastPath, t: lastAt }
  try {
    prev = JSON.parse(sessionStorage.getItem(LAST_VIEW_KEY) ?? 'null') ?? prev
  } catch {
    /* storage unavailable — fall back to memory */
  }
  if (path === prev.p && now - prev.t < DEDUPE_MS) return
  lastPath = path
  lastAt = now
  try {
    sessionStorage.setItem(LAST_VIEW_KEY, JSON.stringify({ p: path, t: now }))
  } catch {
    /* ignore */
  }
  void send('view', path)
}

/**
 * Start the heartbeat that powers "online right now". Only pings while the tab
 * is actually visible, so a background tab isn't counted as a live visitor.
 */
export function startHeartbeat(): () => void {
  /*
   * VISIBLE IS NOT ACTIVE. A tab left open on a second monitor is visible for
   * days; pinging on visibility alone turned one open tab into 43 "active"
   * hours and 1,758 "views" of the calendar (measured on a real session). A
   * ping now needs a person: some input in the last five minutes.
   */
  let lastInput = Date.now()
  const mark = () => {
    lastInput = Date.now()
  }
  const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
  events.forEach((e) => window.addEventListener(e, mark, { passive: true, capture: true }))
  const tick = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastInput < IDLE_MS) {
      void send('ping', lastPath || '/')
    }
  }
  const id = window.setInterval(tick, PING_MS)
  return () => {
    window.clearInterval(id)
    events.forEach((e) => window.removeEventListener(e, mark, { capture: true }))
  }
}

/**
 * The campaign this visit came from, if any.
 *
 * Read at the moment something is CREATED, not at page load: the whole point
 * is to attribute the signup at the end of the journey to the link at the
 * start of it, and the two can be several navigations apart. Session-scoped,
 * so it never reaches across a closed tab and claims credit it did not earn.
 */
export function currentCampaign(): string | null {
  return campaign().utm_campaign ?? null
}
