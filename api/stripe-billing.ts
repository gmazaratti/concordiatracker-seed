/**
 * POST /api/stripe-billing — in-app subscription management.
 *
 * Stripe's hosted Customer Portal refuses to be iframed, so managing a plan
 * without leaving the app means talking to the API directly. Actions:
 *
 *   summary       — current subscription + recent invoices (with PDF links)
 *   cancel        — stop at period end (keeps access until it's paid through)
 *   resume        — undo a pending cancellation
 *   update-card   — a short-lived Stripe session for changing the payment method
 *
 * Every action resolves the subscription from the CALLER'S OWN profile, so a
 * crafted request can't cancel or read anybody else's subscription.
 */
import { authedUser, getProfile, getStripe, readJson, siteUrl } from './_stripe.js'

type Action = 'summary' | 'cancel' | 'resume' | 'update-card'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const user = await authedUser(req)
    if (!user) {
      res.status(401).json({ error: 'Please sign in first.' })
      return
    }

    const { action = 'summary' } = readJson<{ action?: Action }>(req)
    const stripe = getStripe()
    const profile = await getProfile(user.id, 'stripe_customer_id,stripe_subscription_id')
    const customerId = profile?.stripe_customer_id as string | undefined
    const subscriptionId = profile?.stripe_subscription_id as string | undefined

    if (action === 'summary') {
      if (!customerId) {
        res.status(200).json({ subscription: null, invoices: [] })
        return
      }
      const [subs, invoices] = await Promise.all([
        subscriptionId
          ? stripe.subscriptions.retrieve(subscriptionId).catch(() => null)
          : Promise.resolve(null),
        stripe.invoices.list({ customer: customerId, limit: 12 }),
      ])
      const item = subs?.items?.data?.[0]
      res.status(200).json({
        subscription: subs
          ? {
              id: subs.id,
              status: subs.status,
              cancelAtPeriodEnd: subs.cancel_at_period_end,
              currentPeriodEnd:
                (item as unknown as { current_period_end?: number })?.current_period_end ??
                (subs as unknown as { current_period_end?: number }).current_period_end ??
                null,
              trialEnd: subs.trial_end,
              amount: item?.price?.unit_amount ?? null,
              currency: item?.price?.currency ?? 'cad',
              interval: item?.price?.recurring?.interval ?? null,
            }
          : null,
        invoices: invoices.data.map((inv) => ({
          id: inv.id,
          number: inv.number,
          created: inv.created,
          amountPaid: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          // Stripe-hosted, expiring links — we never proxy the PDF ourselves.
          pdf: inv.invoice_pdf,
          url: inv.hosted_invoice_url,
        })),
      })
      return
    }

    if (!subscriptionId) {
      res.status(400).json({ error: 'No active subscription.' })
      return
    }

    if (action === 'cancel') {
      // At period end, never immediately — they paid for the rest of the term.
      const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })
      res.status(200).json({ ok: true, cancelAtPeriodEnd: sub.cancel_at_period_end })
      return
    }

    if (action === 'resume') {
      const sub = await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false })
      res.status(200).json({ ok: true, cancelAtPeriodEnd: sub.cancel_at_period_end })
      return
    }

    if (action === 'update-card') {
      if (!customerId) {
        res.status(400).json({ error: 'No billing account yet.' })
        return
      }
      // A dedicated embedded session just for swapping the card.
      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        ui_mode: 'embedded',
        customer: customerId,
        return_url: `${siteUrl(req)}/app?card=updated`,
      })
      res.status(200).json({ clientSecret: session.client_secret })
      return
    }

    res.status(400).json({ error: 'Unknown action.' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Billing request failed.'
    res.status(500).json({ error: message })
  }
}
