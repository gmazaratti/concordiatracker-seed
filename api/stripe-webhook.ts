/**
 * POST /api/stripe-webhook — Stripe's callback, and the SOURCE OF TRUTH for
 * entitlement.
 *
 * The client never writes plan_status; only this endpoint does, after verifying
 * Stripe's signature over the RAW body. That's what keeps "what you get" locked
 * to "what Stripe actually charged" — a tampered client can't grant itself Pro.
 *
 * Idempotent: Stripe retries deliveries, so each event id is recorded once and
 * repeats are dropped.
 */
import type Stripe from 'stripe'
import { getStripe, patchProfile, supabaseAdmin } from './_stripe.js'

// Signature verification needs the untouched bytes, so opt out of body parsing.
export const config = { api: { bodyParser: false } }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rawBody(req: any): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }
  return Buffer.concat(chunks)
}

/** Record the event id; returns false when we've already handled it. */
async function claimEvent(id: string, type: string): Promise<boolean> {
  const { url, headers } = supabaseAdmin()
  const res = await fetch(`${url}/rest/v1/stripe_events`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ id, type }),
  })
  // 409 = primary-key conflict = already processed.
  return res.ok
}

/** Map a Stripe customer back to our user. */
async function userIdForCustomer(customerId: string): Promise<string | null> {
  const { url, headers } = supabaseAdmin()
  const res = await fetch(
    `${url}/rest/v1/user_profile?select=user_id&stripe_customer_id=eq.${encodeURIComponent(customerId)}`,
    { headers },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as { user_id: string }[]
  return rows[0]?.user_id ?? null
}

const iso = (secs: number | null | undefined) =>
  secs ? new Date(secs * 1000).toISOString() : null

/**
 * Mirror a subscription onto the profile.
 *
 * plan_status is set from the subscription ONLY. A time-limited grant lives in
 * `pro_until` and is deliberately untouched here, so cancelling a subscription
 * can never revoke gifted Pro that hasn't expired yet.
 */
async function syncSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const userId =
    (sub.metadata?.supabase_user_id as string | undefined) || (await userIdForCustomer(customerId))
  if (!userId) return

  const entitled = sub.status === 'active' || sub.status === 'trialing'
  const item = sub.items?.data?.[0]
  // period end lives on the subscription item in current API versions; fall back
  // to the subscription-level field for older shapes.
  const periodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end

  await patchProfile(userId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_price_id: item?.price?.id ?? null,
    current_period_end: iso(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    trial_end: iso(sub.trial_end),
    plan_status: entitled ? 'pro' : 'free',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    res.status(500).json({ error: 'Webhook is not configured.' })
    return
  }

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    const buf = await rawBody(req)
    const sig = req.headers['stripe-signature'] as string
    event = stripe.webhooks.constructEvent(buf, sig, secret)
  } catch (err) {
    // A bad signature means it isn't Stripe — refuse it.
    const message = err instanceof Error ? err.message : 'Invalid signature'
    res.status(400).json({ error: `Webhook signature verification failed: ${message}` })
    return
  }

  try {
    if (!(await claimEvent(event.id, event.type))) {
      res.status(200).json({ received: true, duplicate: true })
      return
    }

    const stripe = getStripe()
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.subscription) {
          const id =
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(id)
          // Carry our user id onto the subscription so later events resolve even
          // if the customer lookup ever misses.
          const userId = session.metadata?.supabase_user_id
          if (userId && !sub.metadata?.supabase_user_id) {
            await stripe.subscriptions.update(id, { metadata: { supabase_user_id: userId } })
            sub.metadata = { ...sub.metadata, supabase_user_id: userId }
          }
          await syncSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      }
      case 'invoice.paid':
      case 'invoice.payment_failed': {
        // Re-read the subscription so status/period reflect the payment outcome.
        const invoice = event.data.object as Stripe.Invoice
        const subRef = (invoice as unknown as { subscription?: string | Stripe.Subscription })
          .subscription
        if (subRef) {
          const id = typeof subRef === 'string' ? subRef : subRef.id
          await syncSubscription(await stripe.subscriptions.retrieve(id))
        }
        break
      }
      default:
        break
    }

    res.status(200).json({ received: true })
  } catch (err) {
    // 500 tells Stripe to retry — better than silently dropping a state change.
    const message = err instanceof Error ? err.message : 'Webhook handling failed'
    res.status(500).json({ error: message })
  }
}
