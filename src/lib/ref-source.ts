/**
 * Source attribution for landing links like concordiatracker.com/r (Reddit).
 *
 * A FIRST-PARTY COOKIE, not a query parameter: the link has to read as a plain,
 * clean URL where it is posted, and the attribution has to survive the visitor
 * clicking around the site and signing up later. 30 days, Lax, whole site.
 *
 * Read by analytics (every site_events row carries `ref`) and by the profile
 * creation at signup (`user_profile.signup_ref`). Values are restricted to a
 * short slug, matching the database CHECK, so a hand-edited cookie cannot write
 * arbitrary text into either table.
 */
const COOKIE = 'ct_ref'
/** Fallback copy for a browser that refuses the cookie (the /l link also passes
 *  the source as `?src=`). NOT `ct_ref`: that localStorage key is the vanity
 *  referral code (useSupabaseProfile), a different thing. */
const STORE = 'ct_ref_source'
const MAX_AGE_S = 60 * 60 * 24 * 30
const SLUG = /^[a-z0-9_-]{1,32}$/

export function setRefSource(value: string): void {
  if (!SLUG.test(value)) return
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${COOKIE}=${value}; Max-Age=${MAX_AGE_S}; Path=/; SameSite=Lax${secure}`
  } catch {
    /* cookies blocked: the stored copy below still carries it */
  }
  try {
    localStorage.setItem(STORE, JSON.stringify({ v: value, until: Date.now() + MAX_AGE_S * 1000 }))
  } catch {
    /* storage blocked too: the visit goes unattributed */
  }
}

function storedSource(): string | null {
  try {
    const raw = localStorage.getItem(STORE)
    if (!raw) return null
    const { v, until } = JSON.parse(raw) as { v?: string; until?: number }
    return typeof v === 'string' && SLUG.test(v) && (until ?? 0) > Date.now() ? v : null
  } catch {
    return null
  }
}

/**
 * `?src=<slug>` on the landing URL (the /l redirect adds it) is stored like the
 * cookie and stripped from the address bar, so a link shared onward does not
 * carry somebody else's attribution. Called once at boot, before the first
 * page view.
 */
export function captureRefParam(): void {
  try {
    const url = new URL(window.location.href)
    const src = url.searchParams.get('src')
    if (!src) return
    if (SLUG.test(src)) setRefSource(src)
    url.searchParams.delete('src')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  } catch {
    /* nothing to capture */
  }
}

export function readRefSource(): string | null {
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))
    const value = hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : ''
    return SLUG.test(value) ? value : storedSource()
  } catch {
    return storedSource()
  }
}
