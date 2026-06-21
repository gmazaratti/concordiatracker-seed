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
import webpush from 'web-push'

interface SubRow {
  endpoint: string
  p256dh: string
  auth: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:concordiatracker@gmail.com'
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
  if (!publicKey || !privateKey || !supabaseUrl || !anon) {
    res.status(500).json({ error: 'Push is not configured on the server yet.' })
    return
  }

  const authHeader: string = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Sign in to send a notification.' })
    return
  }

  // Identify the caller.
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anon },
  })
  if (!who.ok) {
    res.status(401).json({ error: 'Your session expired — sign in again.' })
    return
  }
  const user = await who.json()
  const userId: string | undefined = user?.id
  if (!userId) {
    res.status(401).json({ error: 'Could not identify you.' })
    return
  }

  // Load the caller's OWN subscriptions (RLS scopes this to them).
  const subsRes = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${userId}`,
    { headers: { apikey: anon, Authorization: `Bearer ${token}` } },
  )
  if (!subsRes.ok) {
    res.status(500).json({ error: 'Could not load your devices.' })
    return
  }
  const subs: SubRow[] = await subsRes.json()
  if (!subs.length) {
    res.status(409).json({ error: 'No device is subscribed yet — enable notifications first.' })
    return
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const payload = JSON.stringify({
    title: 'Notifications are on 🎉',
    body: "You'll get your deadline reminders right here.",
    url: '/app',
    tag: 'ct-test',
  })

  let sent = 0
  const stale: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) stale.push(s.endpoint)
      }
    }),
  )

  // Prune endpoints the push service says are gone (the caller's own rows).
  for (const endpoint of stale) {
    await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: { apikey: anon, Authorization: `Bearer ${token}` } },
    )
  }

  res.status(200).json({ sent })
}
