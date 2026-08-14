import { supabase } from './supabase'

/**
 * Client side of billing. Every call carries the user's Supabase access token so
 * the server can identify them — the client never asserts a user id, and never
 * writes entitlement (only the Stripe webhook does).
 */

export interface SubscriptionSummary {
  id: string
  status: string
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: number | null
  trialEnd: number | null
  amount: number | null
  currency: string
  interval: string | null
}

export interface InvoiceRow {
  id: string
  number: string | null
  created: number
  amountPaid: number
  currency: string
  status: string | null
  pdf: string | null
  url: string | null
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in first.')

  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || 'Something went wrong.')
  return json as T
}

/** Start an embedded checkout; returns the client secret for <EmbeddedCheckout>.
 * `carryUntil` (unix seconds) is set when existing time is stacking onto it. */
export function startCheckout(
  plan: 'semester' | 'monthly',
): Promise<{ clientSecret: string; carryUntil: number | null }> {
  return post('/api/stripe-checkout', { plan })
}

export interface CheckoutStatus {
  complete: boolean
  plan: string | null
  trialEnd: number | null
  /** The purchase extended existing time rather than replacing it. */
  stacked: boolean
}

/** Verify a finished checkout (used to gate the celebration). */
export function checkoutStatus(sessionId: string): Promise<CheckoutStatus> {
  return post('/api/stripe-billing', { action: 'checkout-status', sessionId })
}

export function billingSummary(): Promise<{
  subscription: SubscriptionSummary | null
  invoices: InvoiceRow[]
}> {
  return post('/api/stripe-billing', { action: 'summary' })
}

export function cancelSubscription(): Promise<{ ok: boolean; cancelAtPeriodEnd: boolean }> {
  return post('/api/stripe-billing', { action: 'cancel' })
}

export function resumeSubscription(): Promise<{ ok: boolean; cancelAtPeriodEnd: boolean }> {
  return post('/api/stripe-billing', { action: 'resume' })
}

export function startCardUpdate(): Promise<{ clientSecret: string }> {
  return post('/api/stripe-billing', { action: 'update-card' })
}

/** Is billing wired up in this environment? (No key → keep the mock UI honest.) */
export const BILLING_ENABLED = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY

/**
 * True while the site is pointed at Stripe's test mode. Derived from the
 * publishable key itself rather than a hand-maintained flag, so the pricing
 * page can never claim "no card is charged" after the live keys go in — or,
 * worse, imply real charges while only test cards work. Swapping the key in
 * Vercel flips the copy on the next deploy with nothing else to remember.
 */
export const STRIPE_TEST_MODE = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '').startsWith(
  'pk_test_',
)

export function money(cents: number | null, currency = 'cad'): string {
  if (cents === null) return '—'
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

export function fmtDate(unixSeconds: number | null): string {
  if (!unixSeconds) return '—'
  return new Date(unixSeconds * 1000).toLocaleDateString('en-CA', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
