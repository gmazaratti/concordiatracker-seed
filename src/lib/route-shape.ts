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

/**
 * A full URL made safe to hand to ANY analytics, first-party or Vercel's.
 *
 * Query strings and fragments are dropped entirely (support-status links carry
 * `?token=`, password resets carry `#access_token=`), and the path goes through
 * normalizePath, so a single-use club claim link `/join/<token>` arrives as
 * `/join/:token`. A claim token is a credential, not a page view. Anything
 * that is not a parseable URL is reduced to the site root rather than passed on.
 */
export function scrubAnalyticsUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.origin + normalizePath(u.pathname)
  } catch {
    return '/'
  }
}
