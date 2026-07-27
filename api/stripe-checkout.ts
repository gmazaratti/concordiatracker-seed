/**
 * POST /api/stripe-checkout — start an EMBEDDED Stripe Checkout session.
 *
 * Embedded (not hosted) so the payment form mounts inside Settings → Billing
 * rather than bouncing the student to another tab. Returns a `client_secret`
 * the client hands to Stripe's <EmbeddedCheckout>.
 *
 * The caller is identified by their Supabase token — never by a user id in the
 * body — so nobody can start a subscription against someone else's account.
 */
import { authedUser, ensureCustomer, getProfile, getStripe, readJson, siteUrl } from './_stripe.js'

type Plan = 'semester' | 'monthly'

function priceFor(plan: Plan): string | undefined {
  return plan === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_SEMESTER
}

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

    const { plan = 'semester' } = readJson<{ plan?: Plan }>(req)
    const price = priceFor(plan)
    if (!price) {
      res.status(500).json({ error: 'That plan is not configured yet.' })
      return
    }

    const stripe = getStripe()

    // Already subscribed → don't let them buy a second one.
    const profile = await getProfile(user.id, 'subscription_status')
    const status = profile?.subscription_status as string | undefined
    if (status === 'active' || status === 'trialing') {
      res.status(409).json({ error: 'You already have an active subscription.' })
      return
    }

    const customer = await ensureCustomer(stripe, user)

    // A free trial that REQUIRES a card: collect the payment method up front,
    // charge only when the trial ends. Set STRIPE_TRIAL_DAYS to enable.
    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS || 0)
    const trial =
      trialDays > 0
        ? {
            trial_period_days: trialDays,
            trial_settings: {
              end_behavior: { missing_payment_method: 'cancel' as const },
            },
          }
        : {}

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded',
      customer,
      line_items: [{ price, quantity: 1 }],
      // Always take a card, even when the trial means £0 today.
      payment_method_collection: 'always',
      subscription_data: {
        ...trial,
        metadata: { supabase_user_id: user.id },
      },
      // Lets the webhook map the session back to our user even before the
      // subscription object exists.
      metadata: { supabase_user_id: user.id, plan },
      allow_promotion_codes: true,
      return_url: `${siteUrl(req)}/app?checkout={CHECKOUT_SESSION_ID}`,
    })

    res.status(200).json({ clientSecret: session.client_secret })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start checkout.'
    res.status(500).json({ error: message })
  }
}
