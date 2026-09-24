/**
 * Catching the return from a confirmation email.
 *
 * WHAT WENT WRONG, measured with a real generated link. We ask Supabase to
 * send people back to `/app`, and Supabase sends them to the SITE URL instead
 * — `https://concordiatracker.com/` — because a `redirect_to` that is not on
 * the project's allow-list is silently replaced rather than refused. So:
 *
 *   success → the landing page, with `#access_token=…` in the URL
 *   failure → the landing page, with `#error=access_denied…` in the URL
 *
 * In the success case they ARE signed in; they are just looking at the
 * marketing page, which looks identical either way, so it reads as "the link
 * didn't work". In the failure case nothing reads the error at all and the
 * page is silent.
 *
 * Fixing the allow-list is the right fix and it belongs in the dashboard. This
 * makes the app correct WITHOUT it — a redirect setting is exactly the kind of
 * thing that gets changed later by someone who does not know the app depends
 * on it, and landing a confirmed user on the marketing page should not be one
 * configuration edit away, ever.
 *
 * THE HASH IS READ AT MODULE LOAD. `detectSessionInUrl` strips it as soon as
 * supabase-js initialises, so by the time a component effect runs it is gone.
 */

export interface AuthReturn {
  /** A session came back in the URL — this was a confirmation or OAuth return. */
  hasToken: boolean
  /** Supabase's own error, already decoded. */
  error: string | null
  /** `signup`, `recovery`, `magiclink`… when the URL says. */
  type: string | null
}

function read(): AuthReturn {
  if (typeof window === 'undefined') return { hasToken: false, error: null, type: null }
  // Both shapes appear: the hash for the implicit flow, the query for PKCE and
  // for some error returns. Checking one and not the other is how half of
  // these go unnoticed.
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const pick = (k: string) => hash.get(k) ?? query.get(k)

  const rawError = pick('error_description') ?? pick('error')
  return {
    hasToken: !!pick('access_token') || !!pick('code'),
    // Supabase sends these plus-encoded; a raw one would read "link+expired".
    error: rawError ? rawError.replace(/\+/g, ' ') : null,
    type: pick('type'),
  }
}

/**
 * Snapshotted once, at import, for the reason in the header comment.
 * Everything downstream reads this rather than the live URL.
 */
export const authReturn: AuthReturn = read()

/**
 * WHICH PROVIDER WAS BEING TRIED.
 *
 * An OAuth failure comes back as a bare string on the return URL
 * ("Unable to exchange external code") that names neither Google nor Apple.
 * The browser remembers which button was pressed so the message can.
 * sessionStorage, because it only has to survive one round trip.
 */
const OAUTH_KEY = 'ct_oauth_attempt'

export function rememberOAuthAttempt(provider: 'google' | 'apple'): void {
  try {
    sessionStorage.setItem(OAUTH_KEY, provider)
  } catch {
    /* private mode: the message just will not name the provider */
  }
}

function lastOAuthAttempt(): 'google' | 'apple' | null {
  try {
    const v = sessionStorage.getItem(OAUTH_KEY)
    return v === 'google' || v === 'apple' ? v : null
  } catch {
    return null
  }
}

/**
 * A provider error, mapped to a message KEY (so it translates) plus the
 * provider it concerns. Null when the error is not one of these.
 *
 *  - `conflict`: an account already exists for that email under another sign-in
 *    method and could not be joined automatically. The fix is to sign in the
 *    original way and link the second method from Settings.
 *  - `failed`: the provider handshake itself did not finish ("Unable to
 *    exchange external code"). That is a configuration problem on our side,
 *    never the student's account, and the message says so.
 */
export function oauthProblem(
  raw: string,
): { kind: 'conflict' | 'failed'; provider: 'Google' | 'Apple' | null } | null {
  const e = raw.toLowerCase()
  const p = lastOAuthAttempt()
  const provider = p === 'apple' ? 'Apple' : p === 'google' ? 'Google' : null
  if (
    e.includes('already registered') ||
    e.includes('already exists') ||
    e.includes('already been registered') ||
    e.includes('multiple accounts') ||
    e.includes('identity is already linked') ||
    e.includes('email_exists') ||
    e.includes('identity_already_exists')
  ) {
    return { kind: 'conflict', provider }
  }
  if (e.includes('exchange external code') || e.includes('external provider') || e.includes('oauth')) {
    return { kind: 'failed', provider }
  }
  return null
}

/**
 * Say what went wrong in words the person can act on.
 *
 * Supabase's own strings are accurate and unhelpful ("Email link is invalid or
 * has expired"), and the two causes behind that one need different actions:
 * a link already used means they are probably fine, a stale one means start
 * again.
 */
export function explainAuthError(raw: string): string {
  const e = raw.toLowerCase()
  if (e.includes('expired') || e.includes('invalid')) {
    return 'That link has expired or was already used. Sign in below. If that does not work, ask for a fresh link: create the account again, or use Forgot password.'
  }
  if (e.includes('access_denied') || e.includes('denied')) {
    return 'That link could not be used. Try signing in below, or ask for a new link.'
  }
  return raw
}
