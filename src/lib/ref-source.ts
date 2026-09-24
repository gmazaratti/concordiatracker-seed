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
const MAX_AGE_S = 60 * 60 * 24 * 30
const SLUG = /^[a-z0-9_-]{1,32}$/

export function setRefSource(value: string): void {
  if (!SLUG.test(value)) return
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${COOKIE}=${value}; Max-Age=${MAX_AGE_S}; Path=/; SameSite=Lax${secure}`
  } catch {
    /* cookies blocked: the visit simply goes unattributed */
  }
}

export function readRefSource(): string | null {
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))
    const value = hit ? decodeURIComponent(hit.slice(COOKIE.length + 1)) : ''
    return SLUG.test(value) ? value : null
  } catch {
    return null
  }
}
