/**
 * Shared server-side billing helpers. Not an endpoint — the leading underscore
 * keeps Vercel from routing it.
 *
 * Security notes:
 *   • The Stripe SECRET key never leaves the server (no VITE_ prefix, so Vite
 *     can't inline it into the client bundle).
 *   • Every user-facing endpoint identifies the caller by verifying their
 *     Supabase access token against Supabase — the client never just *claims* a
 *     user id, which would let anyone bill or read someone else's account.
 */
import Stripe from 'stripe'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('Billing is not configured (STRIPE_SECRET_KEY missing).')
  return new Stripe(key)
}

export interface AuthedUser {
  id: string
  email: string
}

/** Supabase project URL + service-role key (server-only, bypasses RLS). */
export function supabaseAdmin(): { url: string; headers: Record<string, string> } {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured on the server.')
  return { url, headers: { apikey: key, Authorization: `Bearer ${key}` } }
}

/**
 * Resolve the caller from their `Authorization: Bearer <supabase access token>`.
 * Returns null when the token is missing or invalid.
 */
export async function authedUser(req: {
  headers: Record<string, string | string[] | undefined>
}): Promise<AuthedUser | null> {
  const raw = req.headers['authorization']
  const header = Array.isArray(raw) ? raw[0] : raw
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !anon) return null

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  const user = (await res.json()) as { id?: string; email?: string }
  if (!user?.id) return null
  return { id: user.id, email: user.email ?? '' }
}

/** Read selected columns of a profile row (service role). */
export async function getProfile(
  userId: string,
  columns: string,
): Promise<Record<string, unknown> | null> {
  const { url, headers } = supabaseAdmin()
  const res = await fetch(
    `${url}/rest/v1/user_profile?select=${encodeURIComponent(columns)}&user_id=eq.${userId}`,
    { headers },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as Record<string, unknown>[]
  return rows[0] ?? null
}

/** Patch a profile row (service role — the only path that may write entitlement). */
export async function patchProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
  const { url, headers } = supabaseAdmin()
  await fetch(`${url}/rest/v1/user_profile?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  })
}

/**
 * Find (or create) the Stripe customer for a user, and remember the id so the
 * same person never ends up with two customers.
 */
export async function ensureCustomer(stripe: Stripe, user: AuthedUser): Promise<string> {
  const profile = await getProfile(user.id, 'stripe_customer_id,name')
  const existing = profile?.stripe_customer_id as string | undefined
  if (existing) return existing

  const customer = await stripe.customers.create({
    email: user.email || undefined,
    name: (profile?.name as string) || undefined,
    // The link back to our user — how the webhook maps Stripe events to a row.
    metadata: { supabase_user_id: user.id },
  })
  await patchProfile(user.id, { stripe_customer_id: customer.id })
  return customer.id
}

/** The site origin for Stripe return URLs. */
export function siteUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
  const configured = process.env.PUBLIC_SITE_URL
  if (configured) return configured.replace(/\/$/, '')
  const host = req.headers['x-forwarded-host'] || req.headers['host']
  const h = Array.isArray(host) ? host[0] : host
  const proto = h?.startsWith('localhost') ? 'http' : 'https'
  return h ? `${proto}://${h}` : 'https://concordiatracker.com'
}

/** JSON body parse that tolerates Vercel already having parsed it. */
export function readJson<T>(req: { body?: unknown }): T {
  if (!req.body) return {} as T
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as T
    } catch {
      return {} as T
    }
  }
  return req.body as T
}
