/**
 * Apple purchase state, checked without Apple:   node api/_iap-state.test.mjs
 * The part worth testing is planAfter: Apple must never revoke Pro it did not grant.
 */
import { planAfter, stateFromEvent, stateFromSubscriber, userIdsFromEvent } from './_iap-state.ts'

let bad = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${name}${ok ? '' : `  (${detail})`}`)
  if (!ok) bad++
}
const now = Date.parse('2026-10-11T12:00:00Z')
const uid = '522bb131-3368-45f7-970e-d7f660bb34e7'
const future = '2027-04-11T12:00:00Z'
const past = '2026-09-01T12:00:00Z'

check('uuid app_user_id is ours', userIdsFromEvent({ app_user_id: uid }).join() === uid)
check('anonymous ids are ignored', userIdsFromEvent({ app_user_id: '$RCAnonymousID:abc', aliases: [uid] }).join() === uid)
check('a transfer names both ends', userIdsFromEvent({ transferred_from: [uid], transferred_to: ['8abbbe3c-6aa4-4ca9-a8a4-c37b1ecf0455'] }).length === 2)

const subActive = { subscriber: { entitlements: { pro: { expires_date: future, product_identifier: 'pro_6m' } }, subscriptions: { pro_6m: { is_sandbox: true } } } }
const a = stateFromSubscriber(subActive, now)
check('active subscriber', a?.status === 'active' && a.env === 'SANDBOX' && a.willRenew === true, JSON.stringify(a))
const c = stateFromSubscriber({ subscriber: { entitlements: { pro: { expires_date: future, product_identifier: 'p' } }, subscriptions: { p: { unsubscribe_detected_at: past } } } }, now)
check('cancelled but paid through stays live', c?.status === 'cancelled' && planAfter(c, {}, now) === 'pro', JSON.stringify(c))
const r = stateFromSubscriber({ subscriber: { entitlements: { pro: { expires_date: future, product_identifier: 'p' } }, subscriptions: { p: { refunded_at: past } } } }, now)
check('a refund ends it now', r?.status === 'refunded' && planAfter(r, { plan_status: 'pro', iap_expires_at: future }, now) === 'free', JSON.stringify(r))
check('never subscribed → null', stateFromSubscriber({ subscriber: { entitlements: {} } }, now) === null)

const expired = { expiresAt: past, product: 'p', status: 'expired', env: 'PRODUCTION', willRenew: false }
check('Apple expiry drops Pro Apple granted', planAfter(expired, { plan_status: 'pro', iap_expires_at: future }, now) === 'free')
check('…but not while Stripe is paying', planAfter(expired, { plan_status: 'pro', iap_expires_at: future, subscription_status: 'active' }, now) === undefined)
check('…and never a comp Apple did not grant', planAfter(expired, { plan_status: 'pro', iap_expires_at: null }, now) === undefined)

const ev = stateFromEvent({ type: 'INITIAL_PURCHASE', expiration_at_ms: Date.parse(future), environment: 'SANDBOX', entitlement_ids: ['pro'], product_id: 'p' }, now)
check('purchase event → active', ev?.status === 'active' && planAfter(ev, {}, now) === 'pro', JSON.stringify(ev))
check('EXPIRATION event → expired', stateFromEvent({ type: 'EXPIRATION', expiration_at_ms: Date.parse(past), entitlement_ids: ['pro'] }, now)?.status === 'expired')
check('another entitlement is ignored', stateFromEvent({ type: 'INITIAL_PURCHASE', entitlement_ids: ['other'] }, now) === null)

if (bad) {
  console.log(`\n${bad} failed`)
  process.exit(1)
}
console.log('\niap: all checks passed')
