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
    const customer = await ensureCustomer(stripe, user)

    // ── Stacking ────────────────────────────────────────────────────────────
    // Buying while you already have time left (a trial, or a monthly plan when
    // you upgrade to the semester pass) must never burn that time. The remaining
    // time is carried onto the NEW subscription as a paid-through period, so
    // billing only starts once the old time would have run out. The old
    // subscription is cancelled by the webhook the moment the new one starts, so
    // nobody is ever billed twice.
    const profile = await getProfile(user.id, 'stripe_subscription_id,subscription_status')
    const currentId = profile?.stripe_subscription_id as string | undefined
    const currentStatus = profile?.subscription_status as string | undefined
    const hasTimeLeft = currentStatus === 'active' || currentStatus === 'trialing'

    let carryUntil: number | null = null
    let replaces: string | undefined
    if (hasTimeLeft && currentId) {
      const existing = await stripe.subscriptions.retrieve(currentId).catch(() => null)
      if (existing) {
        const item = existing.items?.data?.[0]
        const end =
          existing.trial_end ??
          (item as unknown as { current_period_end?: number })?.current_period_end ??
          (existing as unknown as { current_period_end?: number }).current_period_end
        if (end && end > Math.floor(Date.now() / 1000)) {
          carryUntil = end
          replaces = existing.id
        }
      }
    }

    // A free trial that REQUIRES a card: collect the payment method up front,
    // charge only when it ends. Set STRIPE_TRIAL_DAYS to enable.
    const trialDays = Number(process.env.STRIPE_TRIAL_DAYS || 0)
    const MIN_TRIAL = Math.floor(Date.now() / 1000) + 49 * 3600 // Stripe needs >48h

    const trial = carryUntil
      ? {
          // Carried-over time wins over a fresh trial — never both, never less.
          trial_end: Math.max(carryUntil, MIN_TRIAL),
          trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } },
        }
      : trialDays > 0
        ? {
            trial_period_days: trialDays,
            trial_settings: { end_behavior: { missing_payment_method: 'cancel' as const } },
          }
        : {}

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ui_mode: 'embedded_page',
      customer,
      line_items: [{ price, quantity: 1 }],
      // Always take a card, even when the trial means $0 today.
      payment_method_collection: 'always',
      // Price in CAD for everyone. Adaptive Pricing would quote each student
      // their local currency at a floating rate, which drifts from the $15
      // advertised on the site — one price, no surprises.
      adaptive_pricing: { enabled: false },
      subscription_data: {
        ...trial,
        metadata: {
          supabase_user_id: user.id,
          // The webhook cancels this the moment the new subscription starts, so
          // the carried-over time can't turn into a double charge.
          ...(replaces ? { replaces_subscription_id: replaces } : {}),
        },
      },
      // Lets the webhook map the session back to our user even before the
      // subscription object exists.
      metadata: {
        supabase_user_id: user.id,
        plan,
        ...(replaces ? { replaces_subscription_id: replaces } : {}),
      },
      allow_promotion_codes: true,
      return_url: `${siteUrl(req)}/app?checkout={CHECKOUT_SESSION_ID}`,
    })

    res.status(200).json({
      clientSecret: session.client_secret,
      // So the UI can say exactly how much time is carrying over.
      carryUntil,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start checkout.'
    res.status(500).json({ error: message })
  }
}
