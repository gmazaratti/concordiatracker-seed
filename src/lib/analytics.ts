import { supabase } from './supabase'

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
/** Ignore repeat views of the same path inside this window (StrictMode, bounces). */
const DEDUPE_MS = 2_000

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

async function send(kind: 'view' | 'ping', path: string): Promise<void> {
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
  if (path === lastPath && now - lastAt < DEDUPE_MS) return
  lastPath = path
  lastAt = now
  void send('view', path)
}

/**
 * Start the heartbeat that powers "online right now". Only pings while the tab
 * is actually visible, so a background tab isn't counted as a live visitor.
 */
export function startHeartbeat(): () => void {
  const tick = () => {
    if (document.visibilityState === 'visible') void send('ping', lastPath || '/')
  }
  const id = window.setInterval(tick, PING_MS)
  return () => window.clearInterval(id)
}
