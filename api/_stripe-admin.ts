/**
 * Stripe, read from the server, as the admin panel needs it.
 *
 * WHY THIS IS NOT READ FROM OUR OWN TABLES. `stripe_events` stores an id, a
 * type and a timestamp -- no amounts, no statuses, no decline reasons -- and
 * `user_profile`'s billing columns are a CACHE written by the webhook. A cache
 * is exactly the thing you cannot use to answer "is our data out of sync",
 * which is the question being asked. So every number here comes from Stripe.
 *
 * WHY A DECLINE REASON IS ITS OWN FIELD. "Payment failed" is not actionable.
 * `card_declined / insufficient_funds` tells the student to use another card;
 * `card_declined / do_not_honor` tells them to call their bank; `expired_card`
 * they can fix in a minute. Stripe gives all three and we were throwing them
 * away.
 */

const API = 'https://api.stripe.com/v1'

export interface StripeMoney {
  /** Cents, as Stripe stores it. Formatting is the UI's job. */
  amount: number
  currency: string
}

export interface StripeSubscriptionView {
  id: string
  status: string
  /** True when it will bill again — the question "is this renewing". */
  renewing: boolean
  cancelAtPeriodEnd: boolean
  startedAt: string | null
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  amount: number | null
  currency: string | null
  /** "every 4 months", "monthly" — what they actually signed up to. */
  interval: string | null
  /** When it was actually cancelled, and when it is scheduled to stop.
   *  "Set to cancel" with no date is a fact you cannot act on. */
  canceledAt: string | null
  cancelAt: string | null
  /** Is a card attached at all? A trial with none is going to lapse, and that
   *  is invisible from every other screen. */
  hasPaymentMethod: boolean
}

export interface StripeInvoiceView {
  id: string
  number: string | null
  createdAt: string
  paidAt: string | null
  amountDue: number
  amountPaid: number
  currency: string
  status: string
  hostedUrl: string | null
  pdfUrl: string | null
}

export interface StripeChargeView {
  id: string
  createdAt: string
  amount: number
  currency: string
  status: string
  paid: boolean
  refunded: boolean
  /** Populated only on a failure. All three, because they say different things. */
  failureCode: string | null
  failureMessage: string | null
  declineCode: string | null
  /** A sentence a human can act on, derived below. */
  outcome: string
  disputed: boolean
}

export interface StripeCustomerView {
  id: string
  email: string | null
  createdAt: string
  /** Lifetime, in cents, per currency — a customer can have both. */
  totalPaid: Record<string, number>
  subscriptions: StripeSubscriptionView[]
  invoices: StripeInvoiceView[]
  charges: StripeChargeView[]
}

function key(): string {
  const k = process.env.STRIPE_SECRET_KEY
  if (!k) throw new Error('STRIPE_SECRET_KEY is not set on this deployment.')
  return k
}

/** Live or test, derived from the key rather than assumed — the whole reason
 *  a reconciliation can look wrong is reading the wrong account. */
export function stripeMode(): 'live' | 'test' {
  return (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_') ? 'live' : 'test'
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}/${path}`, {
    headers: { Authorization: `Bearer ${key()}`, 'Stripe-Version': '2024-06-20' },
  })
  const j = (await r.json()) as T & { error?: { message?: string } }
  if (j.error) throw new Error(j.error.message ?? 'Stripe refused that request.')
  return j
}

const iso = (unix: number | null | undefined) =>
  typeof unix === 'number' ? new Date(unix * 1000).toISOString() : null

/** "16 minutes", "3 days" — how long they lasted. */
function humanGap(from: number, to: number): string {
  const mins = Math.max(0, Math.round((to - from) / 60000))
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'}`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  const days = Math.round(hours / 24)
  return `${days} day${days === 1 ? '' : 's'}`
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * The sentence. Stripe hands back up to three overlapping fields and the one
 * that carries the actionable meaning is `decline_code`, which is also the one
 * most often missing — hence the ladder rather than a lookup on any single one.
 */
function outcomeOf(c: any): string {
  if (c.refunded) return 'Refunded'
  if (c.disputed) return 'Disputed by the cardholder'
  if (c.paid && c.status === 'succeeded') return 'Paid'
  if (c.status === 'pending') return 'Pending with the bank'
  const decline: string | null = c.outcome?.reason ?? c.failure_code ?? null
  const map: Record<string, string> = {
    insufficient_funds: 'Declined: not enough funds. Another card will work.',
    do_not_honor: 'Declined by the bank with no reason given. They have to call their bank.',
    generic_decline: 'Declined by the bank with no reason given.',
    expired_card: 'Declined: the card has expired.',
    incorrect_cvc: 'Declined: the security code was wrong.',
    lost_card: 'Declined: reported lost. Nothing we can do.',
    stolen_card: 'Declined: reported stolen. Nothing we can do.',
    card_not_supported: 'Declined: the card does not support this kind of charge.',
    currency_not_supported: 'Declined: the card cannot be billed in this currency.',
    processing_error: 'The bank had a processing error. Retrying usually works.',
    authentication_required: 'Needs 3-D Secure confirmation from the cardholder.',
    fraudulent: 'Blocked as suspected fraud.',
    highest_risk_level: 'Blocked by Stripe Radar as high risk.',
  }
  if (decline && map[decline]) return map[decline]
  // Stripe's own message is written for the cardholder and is usually decent.
  if (c.failure_message) return c.failure_message
  return decline ? `Failed (${decline})` : 'Failed'
}

function chargeView(c: any): StripeChargeView {
  return {
    id: c.id,
    createdAt: iso(c.created) ?? '',
    amount: c.amount ?? 0,
    currency: c.currency ?? 'cad',
    status: c.status ?? 'unknown',
    paid: !!c.paid,
    refunded: !!c.refunded,
    failureCode: c.failure_code ?? null,
    failureMessage: c.failure_message ?? null,
    declineCode: c.outcome?.reason ?? null,
    outcome: outcomeOf(c),
    disputed: !!c.disputed,
  }
}

function subView(s: any): StripeSubscriptionView {
  const price = s.items?.data?.[0]?.price
  const rec = price?.recurring
  const every = rec ? (rec.interval_count > 1 ? `every ${rec.interval_count} ${rec.interval}s` : `${rec.interval}ly`) : null
  return {
    id: s.id,
    status: s.status,
    // "Renewing" is not the same as "active": an active subscription set to
    // cancel at period end is the single most useful thing to see early.
    renewing: (s.status === 'active' || s.status === 'trialing') && !s.cancel_at_period_end,
    cancelAtPeriodEnd: !!s.cancel_at_period_end,
    startedAt: iso(s.start_date ?? s.created),
    currentPeriodEnd: iso(s.current_period_end),
    trialEndsAt: iso(s.trial_end),
    amount: price?.unit_amount ?? null,
    currency: price?.currency ?? null,
    interval: every,
    canceledAt: iso(s.canceled_at),
    cancelAt: iso(s.cancel_at),
    hasPaymentMethod: !!(s.default_payment_method || s.default_source),
  }
}

/** Everything about one customer, by email. Null when Stripe has never heard
 *  of them, which is a real and common answer — most accounts never pay. */
export async function stripeByEmail(email: string): Promise<StripeCustomerView | null> {
  const found = await get<{ data: any[] }>(
    `customers?email=${encodeURIComponent(email)}&limit=3`,
  )
  const cust = found.data?.[0]
  if (!cust) return null

  const [subs, invoices, charges] = await Promise.all([
    get<{ data: any[] }>(`subscriptions?customer=${cust.id}&status=all&limit=20`),
    get<{ data: any[] }>(`invoices?customer=${cust.id}&limit=30`),
    get<{ data: any[] }>(`charges?customer=${cust.id}&limit=30`),
  ])

  const totalPaid: Record<string, number> = {}
  for (const c of charges.data ?? []) {
    if (!c.paid || c.refunded) continue
    totalPaid[c.currency] = (totalPaid[c.currency] ?? 0) + (c.amount ?? 0) - (c.amount_refunded ?? 0)
  }

  return {
    id: cust.id,
    email: cust.email ?? null,
    createdAt: iso(cust.created) ?? '',
    totalPaid,
    subscriptions: (subs.data ?? []).map(subView),
    invoices: (invoices.data ?? []).map((i) => ({
      id: i.id,
      number: i.number ?? null,
      createdAt: iso(i.created) ?? '',
      paidAt: iso(i.status_transitions?.paid_at),
      amountDue: i.amount_due ?? 0,
      amountPaid: i.amount_paid ?? 0,
      currency: i.currency ?? 'cad',
      status: i.status ?? 'unknown',
      hostedUrl: i.hosted_invoice_url ?? null,
      pdfUrl: i.invoice_pdf ?? null,
    })),
    charges: (charges.data ?? []).map(chargeView),
  }
}

export interface StripeActivity {
  kind: 'subscription'
  label: string
  detail: string | null
  who: string
  at: string
}

export interface StripeRollup {
  mode: 'live' | 'test'
  /** Distinct customers with at least one settled charge over $0. */
  payingCustomers: number
  trialing: number
  activeSubscriptions: number
  cancelling: number
  /** Cents, per currency, all time, net of refunds. */
  revenueTotal: Record<string, number>
  /** Cents per month, from subscriptions that have actually been charged. */
  mrr: number
  currency: string
  /** Emails of the people Stripe says are paying — the reconciliation itself. */
  payingEmails: string[]
  trialingEmails: string[]
  charges: StripeChargeView[]
  /** Subscribed / paid / cancelled, as feed rows. Money events belong in the
   *  activity list beside signups — they are the ones you most want to see. */
  activity: StripeActivity[]
  /** Anything worth saying out loud about how solid these numbers are. */
  notes: string[]
}

/**
 * The whole picture, for the dashboard and the owner API.
 *
 * ONE PASS OVER SUBSCRIPTIONS AND CHARGES, then everything derived from those
 * two lists, so no two numbers on the page can come from different snapshots.
 */
export async function stripeRollup(): Promise<StripeRollup> {
  const [subs, charges] = await Promise.all([
    get<{ data: any[]; has_more: boolean }>('subscriptions?status=all&limit=100&expand[]=data.customer'),
    get<{ data: any[]; has_more: boolean }>('charges?limit=100'),
  ])

  const notes: string[] = []
  if (subs.has_more) notes.push('More than 100 subscriptions exist; this page covers the first 100.')
  if (charges.has_more) notes.push('More than 100 charges exist; revenue covers the most recent 100.')
  if (stripeMode() === 'test') {
    notes.push('These figures come from Stripe TEST mode, not live money.')
  }

  // Who has actually been charged. A trial with a card on file has not.
  const paidBy = new Map<string, string>() // customerId -> email
  const revenueTotal: Record<string, number> = {}
  for (const c of charges.data ?? []) {
    if (!c.paid || c.status !== 'succeeded') continue
    const net = (c.amount ?? 0) - (c.amount_refunded ?? 0)
    if (net <= 0) continue
    revenueTotal[c.currency] = (revenueTotal[c.currency] ?? 0) + net
    const id = typeof c.customer === 'string' ? c.customer : c.customer?.id
    if (id) paidBy.set(id, c.billing_details?.email ?? c.receipt_email ?? '')
  }

  let mrr = 0
  let trialing = 0
  let activeSubscriptions = 0
  let cancelling = 0
  const trialingEmails: string[] = []
  const payingEmails = new Set<string>()
  let currency = 'cad'

  for (const s of subs.data ?? []) {
    const custId = typeof s.customer === 'string' ? s.customer : s.customer?.id
    const email = (typeof s.customer === 'object' ? s.customer?.email : null) ?? paidBy.get(custId) ?? ''
    const price = s.items?.data?.[0]?.price
    const rec = price?.recurring
    if (price?.currency) currency = price.currency

    if (s.status === 'trialing') {
      trialing++
      if (email) trialingEmails.push(email)
    }
    if (s.status === 'active') activeSubscriptions++
    if (s.cancel_at_period_end && (s.status === 'active' || s.status === 'trialing')) cancelling++

    // MRR counts only subscriptions whose owner has actually been charged --
    // a trial that may never convert is not recurring revenue.
    const hasPaid = custId ? paidBy.has(custId) : false
    if (hasPaid && (s.status === 'active' || s.status === 'past_due') && rec) {
      const months = rec.interval === 'year' ? 12 * rec.interval_count
        : rec.interval === 'month' ? rec.interval_count
        : rec.interval === 'week' ? rec.interval_count / 4.345
        : rec.interval_count / 30.44
      if (months > 0) mrr += (price.unit_amount ?? 0) / months
      if (email) payingEmails.add(email)
    }
  }

  for (const email of paidBy.values()) if (email) payingEmails.add(email)

  if (trialing > 0) {
    notes.push(
      `${trialing} subscription${trialing === 1 ? '' : 's'} on a card-backed trial: a real card, no charge yet, so counted separately from paying.`,
    )
  }

  // Subscribed / cancelled / paid, as timeline rows.
  const activity: StripeActivity[] = []
  for (const sub of subs.data ?? []) {
    const email =
      (typeof sub.customer === 'object' ? sub.customer?.email : null) ??
      paidBy.get(typeof sub.customer === 'string' ? sub.customer : sub.customer?.id) ??
      'Unknown'
    const amt = sub.items?.data?.[0]?.price?.unit_amount
    const started = iso(sub.start_date ?? sub.created)
    if (started) {
      activity.push({
        kind: 'subscription',
        label: sub.trial_end ? 'Started a trial' : 'Subscribed',
        detail: amt != null ? `$${(amt / 100).toFixed(2)}` : null,
        who: email,
        at: started,
      })
    }
    const cancelled = iso(sub.canceled_at)
    if (cancelled) {
      activity.push({
        kind: 'subscription',
        label: 'Cancelled',
        // The gap between subscribing and cancelling is the whole story on a
        // churn event, and it is invisible if you only log the cancellation.
        detail: started
          ? `after ${humanGap(new Date(started).getTime(), new Date(cancelled).getTime())}`
          : null,
        who: email,
        at: cancelled,
      })
    }
  }
  for (const c of charges.data ?? []) {
    if (!c.created) continue
    activity.push({
      kind: 'subscription',
      label: c.paid && c.status === 'succeeded' ? 'Payment received' : 'Payment failed',
      detail: `$${((c.amount ?? 0) / 100).toFixed(2)} · ${outcomeOf(c)}`,
      who: c.billing_details?.email ?? c.receipt_email ?? 'Unknown',
      at: iso(c.created) ?? '',
    })
  }

  return {
    mode: stripeMode(),
    activity,
    payingCustomers: paidBy.size,
    trialing,
    activeSubscriptions,
    cancelling,
    revenueTotal,
    mrr: Math.round(mrr),
    currency,
    payingEmails: [...payingEmails],
    trialingEmails,
    charges: (charges.data ?? []).map(chargeView),
    notes,
  }
}
