/**
 * GET /api/admin?action=… — the admin panel's server side.
 *
 *   ?action=stripe-user&email=…   one customer: subscription, invoices, charges
 *   ?action=stripe-rollup         the money, for the dashboard
 *   ?action=reconcile             what Stripe says vs what our tables say
 *
 * WHY A SERVER ROUTE AT ALL. The Stripe secret key can never reach a browser,
 * and the admin panel is a browser. Everything here is a read; nothing writes
 * to Stripe.
 *
 * WHY `is_admin()` AND NOT A ROLE CHECK IN HERE. The same definition the
 * database uses, asked of the database with the caller's own token, so an
 * admin list maintained in one place cannot disagree with a copy kept in
 * another. A non-admin gets 403 before a single Stripe call is made.
 */
import { stripeByEmail, stripeRollup, stripeMode } from './_stripe-admin.js'
import { fail } from './_respond.js'

export const config = { maxDuration: 30 }

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !svcKey) {
    fail(res, 500, 'The admin API is not configured on this server.', { code: 'not_configured' })
    return
  }

  const auth: string = req.headers?.authorization ?? ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!jwt) {
    fail(res, 401, 'Sign in as an admin.')
    return
  }

  // Asked of the database, as the caller. A forged answer would need their
  // service role key, which is the same thing as having the database.
  const check = await fetch(`${url}/rest/v1/rpc/is_admin`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!check.ok || (await check.text()).trim() !== 'true') {
    fail(res, 403, 'Admins only.')
    return
  }

  const action = String(req.query?.action ?? '')
  try {
    if (action === 'stripe-user') {
      const email = String(req.query?.email ?? '').trim()
      if (!email) {
        fail(res, 400, 'Give an email.')
        return
      }
      const customer = await stripeByEmail(email)
      // A student who never paid is the common case, not an error.
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ mode: stripeMode(), customer })
      return
    }

    if (action === 'stripe-rollup') {
      const rollup = await stripeRollup()
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(rollup)
      return
    }

    /**
     * The reconciliation.
     *
     * Our billing columns are a cache the webhook writes, and the question
     * "are they right" cannot be answered by reading the cache. So this pulls
     * both and reports the DIFFERENCES — which is the only part worth looking
     * at, and the part that is invisible on every other screen.
     */
    if (action === 'reconcile') {
      const svc = { apikey: svcKey, Authorization: `Bearer ${svcKey}` }
      const [rollup, profilesRes] = await Promise.all([
        stripeRollup(),
        fetch(
          `${url}/rest/v1/user_profile?select=name,email,plan_status,subscription_status,stripe_customer_id,comped,is_internal`,
          { headers: svc },
        ),
      ])
      const profiles = (await profilesRes.json()) as {
        name: string | null
        email: string | null
        plan_status: string | null
        subscription_status: string | null
        stripe_customer_id: string | null
        comped: boolean | null
        is_internal: boolean | null
      }[]

      const paying = new Set(rollup.payingEmails.map((e) => e.toLowerCase()).filter(Boolean))
      const trialing = new Set(rollup.trialingEmails.map((e) => e.toLowerCase()).filter(Boolean))
      const mismatches: { email: string; name: string | null; stripe: string; ours: string }[] = []

      for (const p of profiles) {
        const email = (p.email ?? '').toLowerCase()
        if (!email || p.is_internal) continue
        const stripeSays = paying.has(email) ? 'paying' : trialing.has(email) ? 'trialing' : 'none'
        const oursSays =
          p.plan_status === 'pro' ? (p.comped ? 'pro (comped)' : 'pro') : 'free'

        // A comped Pro with nothing in Stripe is correct, not a mismatch --
        // that is exactly what the flag is for.
        const fine =
          (stripeSays === 'paying' && p.plan_status === 'pro') ||
          (stripeSays === 'trialing' && p.plan_status === 'pro') ||
          (stripeSays === 'none' && p.plan_status !== 'pro') ||
          (stripeSays === 'none' && p.comped)
        if (!fine) {
          mismatches.push({ email, name: p.name, stripe: stripeSays, ours: oursSays })
        }
      }

      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({
        mode: rollup.mode,
        checkedAt: new Date().toISOString(),
        stripe: {
          paying: rollup.payingEmails,
          trialing: rollup.trialingEmails,
          mrr: rollup.mrr,
          currency: rollup.currency,
          revenueTotal: rollup.revenueTotal,
        },
        ours: {
          pro: profiles.filter((p) => p.plan_status === 'pro' && !p.is_internal).length,
          comped: profiles.filter((p) => p.comped && !p.is_internal).length,
          internal: profiles.filter((p) => p.is_internal).length,
        },
        mismatches,
        notes: rollup.notes,
      })
      return
    }

    fail(res, 400, 'Unknown action.', { hint: 'stripe-user | stripe-rollup | reconcile' })
  } catch (e) {
    // Stripe's own message is the useful one here; the caller is an admin.
    fail(res, 502, e instanceof Error ? e.message : 'Stripe did not answer.', {
      code: 'upstream_error',
    })
  }
}
