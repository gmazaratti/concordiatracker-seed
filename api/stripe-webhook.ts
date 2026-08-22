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
import { getProfile, getStripe, patchProfile, supabaseAdmin } from './_stripe.js'
import { fail } from './_respond.js'
import { formatAmount, formatEmailDate, sendEmail } from './_email.js'

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

  // STALE-EVENT GUARD. When someone upgrades, we cancel their old subscription —
  // which fires `customer.subscription.deleted` for it. Without this, that dead
  // subscription's event would overwrite the row and drop a paying student to
  // free. A non-entitling event is only allowed to write if it's about the
  // subscription we currently consider theirs.
  if (!entitled) {
    const current = await getProfile(userId, 'stripe_subscription_id')
    const currentId = current?.stripe_subscription_id as string | undefined
    if (currentId && currentId !== sub.id) return
  }

  const item = sub.items?.data?.[0]
  // period end lives on the subscription item in current API versions; fall back
  // to the subscription-level field for older shapes.
  const periodEnd =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end

  // Store what Stripe actually charges, normalised to months, so the admin
  // revenue rollup never has to guess from prices hardcoded elsewhere.
  const recurring = item?.price?.recurring
  const intervalMonths =
    recurring?.interval === 'year'
      ? 12 * (recurring.interval_count ?? 1)
      : recurring?.interval === 'week'
        ? (recurring.interval_count ?? 1) / 4.345
        : recurring?.interval === 'day'
          ? (recurring.interval_count ?? 1) / 30.44
          : (recurring?.interval_count ?? 1) // months

  await patchProfile(userId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    subscription_status: sub.status,
    subscription_price_id: item?.price?.id ?? null,
    subscription_amount_cents: item?.price?.unit_amount ?? null,
    subscription_interval_months: recurring ? intervalMonths : null,
    current_period_end: iso(periodEnd),
    cancel_at_period_end: !!sub.cancel_at_period_end,
    trial_end: iso(sub.trial_end),
    plan_status: entitled ? 'pro' : 'free',
  })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    fail(res, 405, 'Method not allowed')
    return
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    fail(res, 500, 'Webhook is not configured.')
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
    fail(res, 400, `Webhook signature verification failed: ${message}`)
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

          // The student upgraded while they still had time left. That time was
          // carried onto this new subscription as a paid-through period, so the
          // old one must go NOW — otherwise they'd be billed for both.
          const replaced =
            session.metadata?.replaces_subscription_id ?? sub.metadata?.replaces_subscription_id
          if (replaced && replaced !== sub.id) {
            await stripe.subscriptions.cancel(replaced).catch(() => {
              /* already gone — nothing to undo */
            })
          }

          // Sync AFTER the cancellation, so the cancel's own webhook can't
          // overwrite this subscription's row with the dead one's "canceled".
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
      case 'invoice.upcoming': {
        // The renewal notice the Terms commit us to. Stripe sends this ahead of
        // the charge; the lead time is a dashboard setting and must be 7 days,
        // because no amount of code makes a 3-day webhook arrive earlier.
        await sendRenewalNotice(event.data.object as Stripe.Invoice)
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
    fail(res, 500, message)
  }
}

/**
 * "Your pass renews on Monday."
 *
 * Sent by us, not by Stripe's own reminder toggle, for three reasons: it has to
 * match the wording in the Terms, it has to carry the cancel link into our
 * Settings rather than a generic portal, and it is the one email a student is
 * most likely to resent receiving late — so its timing needs to be something we
 * can point at rather than a checkbox in someone else's dashboard.
 *
 * Never throws. A failed email must not 500 the webhook and make Stripe retry
 * the whole event.
 */
async function sendRenewalNotice(invoice: Stripe.Invoice) {
  try {
    const to = invoice.customer_email
    if (!to) return
    // A zero-amount or trial invoice is not a renewal anyone needs warning about.
    const amount = invoice.amount_due ?? 0
    if (amount <= 0) return

    const renewsAt =
      invoice.next_payment_attempt ??
      (invoice as unknown as { period_end?: number }).period_end ??
      null

    await sendEmail({
      to,
      subject: `Your ConcordiaTracker pass renews ${renewsAt ? 'on ' + formatEmailDate(renewsAt) : 'soon'}`,
      heading: 'Your pass renews soon',
      paragraphs: [
        'This is the heads-up we promise in our Terms, so a renewal never arrives as a surprise on your statement.',
        'Nothing to do if you want to keep going \u2014 it renews on its own.',
      ],
      facts: [
        { label: 'Amount', value: formatAmount(amount, invoice.currency ?? 'cad') },
        ...(renewsAt ? [{ label: 'Renews', value: formatEmailDate(renewsAt) }] : []),
      ],
      button: { label: 'Manage your plan', href: 'https://concordiatracker.com/app?settings=billing' },
      footnote:
        'Cancel any time before that date and you keep access until the end of the period you have already paid for. If it renews and you would rather it had not, you have 14 days to ask for a full refund \u2014 just reply to this email.',
    })
  } catch (err) {
    console.error('[stripe-webhook] renewal notice failed', err)
  }
}
