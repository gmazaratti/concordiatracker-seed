/**
 * POST /api/send-push — send a test push notification to the caller's own
 * subscribed devices.
 *
 * Runs on the Vercel NODE runtime (no edge config) because `web-push` needs Node
 * crypto. Verifies the Supabase JWT, loads the caller's own push_subscriptions
 * (RLS, via their token — no service role needed), and sends an encrypted,
 * VAPID-signed push to each. Expired endpoints (404/410) are pruned.
 *
 * The matching VAPID PRIVATE key is read from the server env (VAPID_PRIVATE_KEY);
 * only the PUBLIC key is embedded here (it's public by design).
 */
import { fail } from './_respond.js'
import { SUB_COLS, closePush, sendPush, type PushTarget } from './_push-send.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    fail(res, 405, 'Method not allowed')
    return
  }

  // Delivery keys (VAPID for browsers, APNS_* for iPhones) are checked per
  // device inside sendPush; this endpoint only needs to reach the database.
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !anon) {
    fail(res, 500, 'Push is not configured on the server yet.')
    return
  }

  const authHeader: string = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    fail(res, 401, 'Sign in to send a notification.')
    return
  }

  // Identify the caller.
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  })
  if (!who.ok) {
    fail(res, 401, 'Your session expired. Sign in again.')
    return
  }
  const user = await who.json()
  const userId: string | undefined = user?.id
  if (!userId) {
    fail(res, 401, 'Could not identify you.')
    return
  }

  // Load the caller's OWN subscriptions (RLS scopes this to them).
  const subsRes = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?select=${SUB_COLS}&user_id=eq.${userId}`,
    { headers: { apikey: anon, Authorization: `Bearer ${token}` } },
  )
  if (!subsRes.ok) {
    fail(res, 500, 'Could not load your devices.')
    return
  }
  const subs: PushTarget[] = await subsRes.json()
  if (!subs.length) {
    fail(res, 409, 'No device is subscribed yet. Enable notifications first.')
    return
  }

  const msg = {
    title: 'Notifications are on 🎉',
    body: "You'll get your deadline reminders right here.",
    url: '/app',
    tag: 'ct-test',
  }

  let sent = 0
  let skipped = 0
  const stale: string[] = []
  for (const s of subs) {
    const r = await sendPush(s, msg)
    if (r.status === 'ok') sent++
    else if (r.status === 'gone') stale.push(s.endpoint)
    else if (r.status === 'skipped') skipped++
  }
  closePush()

  // Prune endpoints the push service says are gone (the caller's own rows).
  for (const endpoint of stale) {
    await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: { apikey: anon, Authorization: `Bearer ${token}` } },
    )
  }

  // Nothing delivered because the server has no keys for this kind of device
  // is a configuration problem, and saying "sent" would hide it.
  if (sent === 0 && skipped > 0) {
    fail(res, 503, 'Push is not configured on the server for this device yet.')
    return
  }
  res.status(200).json({ sent })
}
