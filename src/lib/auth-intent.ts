/**
 * Where to go once you are signed in.
 *
 * Every sign-in route ends somewhere fixed: OAuth returns to `/app` (or to the
 * Site URL when Supabase rewrites an unlisted redirect), and the email form
 * lives on `/app`. So a page that sends somebody to sign in — an invite link,
 * above all — lost them the moment they left: they came back to the student
 * app, or to the portal's front door, and the invite was gone. That is the
 * "dead-ends at the login screen" bug.
 *
 * The page records its own path here BEFORE sending them off, and
 * `AuthIntentRedirect` takes it back once a session exists. localStorage, not
 * sessionStorage: OAuth can come back in a new tab on a phone, and a new tab
 * has an empty sessionStorage.
 *
 * Only a same-site path is ever stored or followed (it must start with a
 * single "/"), and it expires after 30 minutes, so an abandoned sign-in cannot
 * yank somebody somewhere next week.
 */
const KEY = 'ct_auth_return'
const TTL_MS = 30 * 60_000

function safe(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
}

export function rememberReturn(path: string): void {
  if (!safe(path)) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }))
  } catch {
    /* storage unavailable: the page still works, it just will not resume */
  }
}

/**
 * The pending path, WITHOUT consuming it. It is cleared only once somebody is
 * actually on it (`clearReturn`): a brand-new account is also redirected to
 * student onboarding at the same moment, and if that navigation wins the
 * race the path must still be there to correct it on the next render.
 */
export function peekReturn(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { path?: unknown; at?: unknown }
    if (typeof v.path !== 'string' || typeof v.at !== 'number') return null
    if (Date.now() - v.at > TTL_MS || !safe(v.path)) {
      localStorage.removeItem(KEY)
      return null
    }
    return v.path
  } catch {
    return null
  }
}

export function clearReturn(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
