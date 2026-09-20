import { supabase } from '@/lib/supabase'

/**
 * Everything the user pop-out reads.
 *
 * Three sources, deliberately kept apart: our own tables (activity), the
 * audit log (what an admin did and why), and Stripe (the money). The third
 * goes through `/api/admin` because the secret key cannot reach a browser —
 * and because the whole point of asking Stripe is to check our own cached
 * columns against it, which reading our own columns cannot do.
 */

export interface UserSummary {
  joined_at: string | null
  last_visit_at: string | null
  visits: number
  /** Sessions with a single event: no measurable length, counted not averaged. */
  visits_unmeasurable: number
  total_seconds: number
  avg_seconds: number
  events_total: number
  page_views: number
  courses: number
  assignments: number
  parses: number
  tickets: number
  first_seen: string | null
}

export interface UserVisit {
  session_id: string
  started_at: string
  ended_at: string
  seconds: number
  events: number
  device: string | null
  source: string
  first_path: string | null
}

export interface AuditEntry {
  id: number
  actor_email: string | null
  action: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  reason: string
  created_at: string
}

export interface StripeSubscription {
  id: string
  status: string
  renewing: boolean
  cancelAtPeriodEnd: boolean
  startedAt: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  amount: number | null
  currency: string | null
  interval: string | null
  canceledAt: string | null
  cancelAt: string | null
  hasPaymentMethod: boolean
}

export interface StripeInvoice {
  id: string
  number: string | null
  createdAt: string
  paidAt: string | null
  amountDue: number
  amountPaid: number
  currency: string
  status: string
  hostedUrl: string | null
}

export interface StripeCharge {
  id: string
  createdAt: string
  amount: number
  currency: string
  status: string
  paid: boolean
  refunded: boolean
  failureCode: string | null
  declineCode: string | null
  outcome: string
  disputed: boolean
}

export interface StripeCustomer {
  id: string
  email: string | null
  createdAt: string
  totalPaid: Record<string, number>
  subscriptions: StripeSubscription[]
  invoices: StripeInvoice[]
  charges: StripeCharge[]
}

export async function userSummary(userId: string): Promise<UserSummary | null> {
  const { data, error } = await supabase.rpc('admin_user_summary', { p_user: userId })
  if (error) throw error
  const d = data as UserSummary | null
  return d && Object.keys(d).length > 0 ? d : null
}

export async function userVisits(userId: string, limit = 50): Promise<UserVisit[]> {
  const { data, error } = await supabase.rpc('admin_user_visits', { p_user: userId, p_limit: limit })
  if (error) throw error
  return (data ?? []) as UserVisit[]
}

export async function userAudit(userId: string): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc('admin_audit_for_user', { p_user: userId, p_limit: 100 })
  if (error) throw error
  return (data ?? []) as AuditEntry[]
}

/** Records the change AND the reason in one call — see db/admin_audit.sql. */
export async function setPlanLogged(
  userId: string,
  pro: boolean,
  reason: string,
  until: string | null,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_plan', {
    p_target: userId,
    p_pro: pro,
    p_reason: reason,
    p_until: until,
  })
  if (error) throw error
}

export async function setFlagsLogged(
  userId: string,
  internal: boolean | null,
  comped: boolean | null,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('admin_set_flags', {
    p_target: userId,
    p_internal: internal,
    p_comped: comped,
    p_reason: reason,
  })
  if (error) throw error
}

/** Stripe, live, through the server. Null means Stripe has never heard of
 *  them, which is the common and correct answer for most accounts. */
export async function stripeForUser(
  email: string,
): Promise<{ mode: 'live' | 'test'; customer: StripeCustomer | null }> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in again.')
  const res = await fetch(`/api/admin?action=stripe-user&email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const json = (await res.json().catch(() => ({}))) as {
    error?: string
    mode?: 'live' | 'test'
    customer?: StripeCustomer | null
  }
  if (!res.ok) throw new Error(json.error || `Stripe lookup failed (${res.status}).`)
  return { mode: json.mode ?? 'test', customer: json.customer ?? null }
}

/* ── Formatting, shared by every tab so they cannot disagree ──────────────── */

export function money(cents: number, currency = 'cad'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function duration(seconds: number): string {
  if (seconds <= 0) return '—'
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ${seconds % 60}s`
  return `${Math.floor(m / 60)}h ${m % 60}m`
}

export function when(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function day(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
