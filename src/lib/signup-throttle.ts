/**
 * A brake on repeat sign-up attempts, so nobody can sit here emailing someone
 * a confirmation link over and over.
 *
 * BE CLEAR ABOUT WHAT THIS IS. It lives in the browser, so anyone willing to
 * open a private window or clear storage walks straight past it. It is not the
 * security control and must never be described as one. It stops the case that
 * actually happens — a bored person, a stuck form, a double-click, someone
 * mashing the button because the email has not arrived yet — and that is worth
 * having on its own.
 *
 * THE REAL LIMIT IS SUPABASE'S, set in the dashboard under Authentication →
 * Rate Limits, and it is enforced per IP on their side where it cannot be
 * cleared. This is the polite layer in front of it, which also lets us say
 * something useful ("wait 12 minutes") instead of surfacing a raw 429.
 *
 * Deliberately keyed on the EMAIL as well as the browser, because the harm
 * being prevented is to the person receiving the mail, not to us.
 */

/** One attempt per address per this long. A confirmation mail is not urgent. */
export const PER_EMAIL_MS = 15 * 60 * 1000

/** And at most this many different sign-ups from one browser in an hour. */
export const PER_BROWSER_LIMIT = 3
export const PER_BROWSER_WINDOW_MS = 60 * 60 * 1000

const KEY = 'ct_signup_attempts'

export interface Attempt {
  /** Lower-cased address. Stored to throttle per recipient, not just per browser. */
  email: string
  at: number
}

export type ThrottleVerdict =
  | { ok: true }
  | { ok: false; reason: 'email' | 'browser'; retryAfterMs: number }

/** Attempts still inside the longest window; anything older is dead weight. */
export function prune(attempts: Attempt[], now: number): Attempt[] {
  const oldest = now - Math.max(PER_EMAIL_MS, PER_BROWSER_WINDOW_MS)
  return attempts.filter((a) => a.at > oldest)
}

/**
 * May this address be sent another confirmation right now?
 *
 * `now` is a parameter so this is pure and testable, and so the UI can render
 * a countdown from the same number it was judged against.
 */
export function checkSignup(attempts: Attempt[], email: string, now: number): ThrottleVerdict {
  const addr = email.trim().toLowerCase()
  const live = prune(attempts, now)

  const sameEmail = live.filter((a) => a.email === addr).sort((x, y) => y.at - x.at)[0]
  if (sameEmail && now - sameEmail.at < PER_EMAIL_MS) {
    return { ok: false, reason: 'email', retryAfterMs: PER_EMAIL_MS - (now - sameEmail.at) }
  }

  const recent = live.filter((a) => now - a.at < PER_BROWSER_WINDOW_MS)
  if (recent.length >= PER_BROWSER_LIMIT) {
    const oldestOfThose = Math.min(...recent.map((a) => a.at))
    return {
      ok: false,
      reason: 'browser',
      retryAfterMs: PER_BROWSER_WINDOW_MS - (now - oldestOfThose),
    }
  }
  return { ok: true }
}

/** "12 minutes" / "40 seconds" — a wait you can act on, not a timestamp. */
export function waitLabel(ms: number): string {
  const mins = Math.ceil(ms / 60000)
  if (mins <= 1) return `${Math.max(5, Math.ceil(ms / 1000))} seconds`
  return `${mins} minutes`
}

// ── Storage. Every access is guarded: a private window or blocked site data
//    throws on read, and failing to sign up because of a full disk would be a
//    far worse bug than the one this prevents. On any failure it FAILS OPEN,
//    because Supabase's own limit is still underneath.
export function readAttempts(): Attempt[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (a): a is Attempt =>
        !!a && typeof (a as Attempt).email === 'string' && typeof (a as Attempt).at === 'number',
    )
  } catch {
    return []
  }
}

export function recordAttempt(email: string, now: number): void {
  try {
    const next = prune(readAttempts(), now)
    next.push({ email: email.trim().toLowerCase(), at: now })
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable — Supabase's limit still applies */
  }
}
