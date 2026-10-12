/**
 * RevenueCat (Apple in-app purchases) → the profile.
 *
 * Two doors in, one way to write:
 *   POST /api/revenuecat-webhook  RevenueCat's webhook, rewritten onto
 *        stripe-webhook?source=revenuecat (the Hobby plan's 12-function cap).
 *        Authenticated by the Authorization value set in RevenueCat's
 *        dashboard, compared against REVENUECAT_WEBHOOK_AUTH.
 *   stripe-billing action 'iap-sync'  the app, straight after a purchase or a
 *        restore, so Pro unlocks without waiting on the webhook.
 *
 * Both re-read the subscriber from RevenueCat's REST API when
 * REVENUECAT_SECRET_KEY is set (what is true now beats what one event said)
 * and both write through applyIap, so the two can never disagree.
 */
import { timingSafeEqual } from 'node:crypto'
import { getProfile, patchProfile } from './_stripe.js'
import { fail } from './_respond.js'
import { planAfter, stateFromEvent, stateFromSubscriber, userIdsFromEvent, type IapState } from './_iap-state.js'

async function fetchSubscriber(userId: string): Promise<IapState | null | undefined> {
  const key = process.env.REVENUECAT_SECRET_KEY
  if (!key) return undefined
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`RevenueCat answered ${res.status}`)
  return stateFromSubscriber(await res.json(), Date.now())
}

/** Write one user's Apple state, and plan_status only where planAfter says so. */
export async function applyIap(userId: string, state: IapState | null): Promise<{ pro: boolean }> {
  const profile = await getProfile(userId, 'plan_status,subscription_status,iap_expires_at,pro_until,team_pro')
  if (!profile) return { pro: false }
  if (!state) {
    return { pro: profile.plan_status === 'pro' || !!profile.team_pro }
  }
  const plan = planAfter(state, profile, Date.now())
  await patchProfile(userId, {
    iap_expires_at: state.expiresAt,
    iap_product: state.product,
    iap_status: state.status,
    iap_env: state.env,
    iap_will_renew: state.willRenew,
    ...(plan ? { plan_status: plan } : {}),
  })
  const finalPlan = plan ?? profile.plan_status
  return { pro: finalPlan === 'pro' || !!profile.team_pro }
}

/** The app asks right after buying or restoring. */
export async function syncIapForUser(userId: string): Promise<{ pro: boolean; configured: boolean }> {
  const state = await fetchSubscriber(userId)
  if (state === undefined) return { pro: false, configured: false }
  return { ...(await applyIap(userId, state)), configured: true }
}

function authOk(header: string | undefined): boolean {
  const want = process.env.REVENUECAT_WEBHOOK_AUTH
  if (!want || !header) return false
  const a = Buffer.from(header)
  const b = Buffer.from(want)
  const bearer = Buffer.from(`Bearer ${want}`)
  return (a.length === b.length && timingSafeEqual(a, b)) || (a.length === bearer.length && timingSafeEqual(a, bearer))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleRevenueCatWebhook(req: any, res: any, raw: Buffer) {
  const auth = req.headers['authorization']
  if (!authOk(Array.isArray(auth) ? auth[0] : auth)) {
    fail(res, 401, 'Not RevenueCat.')
    return
  }
  let event: Record<string, unknown>
  try {
    event = (JSON.parse(raw.toString('utf8')) as { event?: Record<string, unknown> }).event ?? {}
  } catch {
    fail(res, 400, 'Body is not JSON.')
    return
  }
  try {
    // No dedupe on purpose: applying re-reads the subscriber and writes the
    // same row, so a repeated delivery is harmless, and a recorded-then-failed
    // delivery would be lost forever on retry.
    // TEST events from the dashboard carry no real user; acknowledge them.
    for (const userId of userIdsFromEvent(event)) {
      const fresh = await fetchSubscriber(userId)
      await applyIap(userId, fresh === undefined ? stateFromEvent(event, Date.now()) : fresh)
    }
    res.status(200).json({ received: true })
  } catch (err) {
    // 500 makes RevenueCat retry rather than lose a state change.
    fail(res, 500, err instanceof Error ? err.message : 'Webhook failed.')
  }
}
