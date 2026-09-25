/**
 * Straight into the app after signing in, with nothing drawn on the way.
 *
 * WHAT HAPPENED BEFORE. Supabase sends a sign-in return (Google, Apple, a
 * confirmation link) to the Site URL, `/`, whenever the `/app` address we
 * asked for is not on its allow-list (measured 2026-09-15, auth-return.ts).
 * So the landing page rendered first, then AuthProvider noticed the token and
 * did a full reload into `/app`, which booted the whole app a second time:
 * landing, blank, spinner, Today. That is the "jumps you around".
 *
 * THIS RUNS BEFORE REACT. It is imported first in main.tsx, reads the URL, and
 * if the landing page is holding a sign-in return it replaces the location
 * with the same return on `/app` (or `/reset-password` for a reset link) and
 * tells main.tsx not to render. One navigation, no landing flash. An error
 * return goes to `/app` too, because the sign-in screen is what reads and
 * explains it.
 *
 * Harmless when the allow-list is fixed: the return then lands on `/app`
 * directly and this does nothing.
 */
function bounce(): boolean {
  if (typeof window === 'undefined' || window.location.pathname !== '/') return false
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const has = (k: string) => hash.has(k) || query.has(k)
  if (!has('access_token') && !has('code') && !has('error') && !has('error_description')) return false
  const type = hash.get('type') ?? query.get('type')
  const to = type === 'recovery' ? '/reset-password' : '/app'
  window.location.replace(to + window.location.search + window.location.hash)
  return true
}

/** True when the page is leaving for the app; main.tsx then renders nothing. */
export const bouncing = bounce()
