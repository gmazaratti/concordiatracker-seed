/**
 * Apple purchases (through RevenueCat) → what we store. PURE: no imports, clock
 * passed in, so `_iap-state.test.mjs` runs it in Node directly.
 *
 * Two inputs, one answer. The webhook event says roughly what happened; the
 * subscriber record from RevenueCat's REST API says what is true now. The I/O
 * half prefers the subscriber record and falls back to the event only when no
 * REST key is configured.
 */
export const ENTITLEMENT = 'pro'

export type IapStatus = 'active' | 'cancelled' | 'billing_issue' | 'expired' | 'refunded'

export interface IapState {
  expiresAt: string | null
  product: string | null
  status: IapStatus
  env: 'SANDBOX' | 'PRODUCTION' | null
  willRenew: boolean | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Our user ids are Supabase uuids (the app calls Purchases.logIn with one).
 *  RevenueCat's anonymous ids are ignored: they belong to nobody we know. */
export function userIdsFromEvent(e: Record<string, unknown>): string[] {
  const pool: unknown[] = [
    e.app_user_id,
    e.original_app_user_id,
    ...(Array.isArray(e.aliases) ? e.aliases : []),
    ...(Array.isArray(e.transferred_to) ? e.transferred_to : []),
    ...(Array.isArray(e.transferred_from) ? e.transferred_from : []),
  ]
  return [...new Set(pool.filter((v): v is string => typeof v === 'string' && UUID.test(v)).map((v) => v.toLowerCase()))]
}

/** From GET /v1/subscribers/{id}. Null when they have never held the entitlement. */
export function stateFromSubscriber(body: unknown, now: number): IapState | null {
  const sub = (body as { subscriber?: Record<string, unknown> } | null)?.subscriber
  const ent = (sub?.entitlements as Record<string, { expires_date?: string | null; product_identifier?: string }> | undefined)?.[ENTITLEMENT]
  if (!ent) return null
  const product = ent.product_identifier ?? null
  const s = product
    ? (sub?.subscriptions as Record<string, Record<string, unknown>> | undefined)?.[product]
    : undefined
  const expiresAt = ent.expires_date ?? null
  const live = !expiresAt || Date.parse(expiresAt) > now
  const status: IapStatus = s?.refunded_at
    ? 'refunded'
    : !live
      ? 'expired'
      : s?.billing_issues_detected_at
        ? 'billing_issue'
        : s?.unsubscribe_detected_at
          ? 'cancelled'
          : 'active'
  return {
    expiresAt: status === 'refunded' ? new Date(now).toISOString() : expiresAt,
    product,
    status,
    env: s ? (s.is_sandbox ? 'SANDBOX' : 'PRODUCTION') : null,
    willRenew: s ? !s.unsubscribe_detected_at && live && !s.refunded_at : null,
  }
}

/** Fallback when no REST key is configured: read the webhook event itself. */
export function stateFromEvent(e: Record<string, unknown>, now: number): IapState | null {
  const type = String(e.type ?? '')
  const ents = Array.isArray(e.entitlement_ids) ? e.entitlement_ids : e.entitlement_id ? [e.entitlement_id] : []
  if (ents.length > 0 && !ents.includes(ENTITLEMENT)) return null
  const ms = typeof e.expiration_at_ms === 'number' ? e.expiration_at_ms : null
  const env = e.environment === 'SANDBOX' ? 'SANDBOX' : e.environment === 'PRODUCTION' ? 'PRODUCTION' : null
  const product = typeof e.product_id === 'string' ? e.product_id : null
  const refunded = type === 'CANCELLATION' && e.cancel_reason === 'CUSTOMER_SUPPORT'
  const expiresAt = refunded ? new Date(now).toISOString() : ms ? new Date(ms).toISOString() : null
  const live = !!expiresAt && Date.parse(expiresAt) > now
  const status: IapStatus = refunded
    ? 'refunded'
    : type === 'EXPIRATION' || !live
      ? 'expired'
      : type === 'BILLING_ISSUE'
        ? 'billing_issue'
        : type === 'CANCELLATION'
          ? 'cancelled'
          : 'active'
  return { expiresAt, product, status, env, willRenew: status === 'active' }
}

/**
 * The plan_status to write, or undefined to leave it alone.
 *
 * Apple only ever revokes what Apple granted: an expiry drops a student to free
 * only when the row's Pro came from an Apple purchase (it held an iap expiry
 * before) AND no Stripe subscription is paying for it. Comped and gifted Pro is
 * never touched from here.
 */
export function planAfter(
  state: IapState,
  profile: { plan_status?: unknown; subscription_status?: unknown; iap_expires_at?: unknown },
  now: number,
): 'pro' | 'free' | undefined {
  const live = !!state.expiresAt && Date.parse(state.expiresAt) > now
  if (live) return 'pro'
  const stripeActive = profile.subscription_status === 'active' || profile.subscription_status === 'trialing'
  if (stripeActive) return undefined
  if (profile.plan_status === 'pro' && profile.iap_expires_at) return 'free'
  return undefined
}
