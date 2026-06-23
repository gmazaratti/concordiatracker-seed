/**
 * POST /api/run-reminders — the scheduled reminder dispatcher.
 *
 * Called by Supabase pg_cron every ~15 min (gated by a shared CRON_SECRET, so
 * the public can't trigger it). Runs on the Vercel NODE runtime (web-push needs
 * Node crypto). Finds reminders whose time has come and haven't been sent, pushes
 * to each owner's devices using the service-role key (cross-user read), then
 * marks them sent so they never repeat. Expired endpoints (404/410) are pruned.
 */
import webpush from 'web-push'

interface Reminder {
  id: string
  user_id: string
  title: string
  body: string
  url: string
}
interface SubRow {
  endpoint: string
  p256dh: string
  auth: string
}

interface AdminDigest {
  user_id: string
  total: number
  users: number
  features: number
  bugs: number
  applications: number
}

/** Build the digest body, e.g. "2 new signups · 1 feature request". */
function adminBody(d: AdminDigest): string {
  const parts: string[] = []
  if (d.users) parts.push(`${d.users} new ${d.users === 1 ? 'signup' : 'signups'}`)
  if (d.features) parts.push(`${d.features} feature ${d.features === 1 ? 'request' : 'requests'}`)
  if (d.bugs) parts.push(`${d.bugs} bug ${d.bugs === 1 ? 'report' : 'reports'}`)
  if (d.applications) parts.push(`${d.applications} application${d.applications === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

const BATCH = 200

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // Only the cron (which knows the secret) may trigger a send.
  const cronSecret = process.env.CRON_SECRET
  const authHeader: string = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!cronSecret || token !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:concordiatracker@gmail.com'
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!publicKey || !privateKey || !supabaseUrl || !serviceKey) {
    res.status(500).json({ error: 'Reminder sending is not configured.' })
    return
  }

  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  webpush.setVapidDetails(subject, publicKey, privateKey)

  // Due, un-sent reminders.
  const now = new Date().toISOString()
  const dueRes = await fetch(
    `${supabaseUrl}/rest/v1/reminders?select=id,user_id,title,body,url` +
      `&sent_at=is.null&fire_at=lte.${now}&order=fire_at.asc&limit=${BATCH}`,
    { headers: svc },
  )
  if (!dueRes.ok) {
    res.status(500).json({ error: 'Could not read reminders.' })
    return
  }
  const due: Reminder[] = await dueRes.json()
  if (!due.length) {
    res.status(200).json({ processed: 0, sent: 0 })
    return
  }

  // Cache subscriptions per user (several reminders can share an owner).
  const subsByUser = new Map<string, SubRow[]>()
  async function subsFor(userId: string): Promise<SubRow[]> {
    const cached = subsByUser.get(userId)
    if (cached) return cached
    const r = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&user_id=eq.${userId}`,
      { headers: svc },
    )
    const list: SubRow[] = r.ok ? await r.json() : []
    subsByUser.set(userId, list)
    return list
  }

  let sent = 0
  const stale = new Set<string>()
  const processedIds: string[] = []

  for (const rem of due) {
    const subs = await subsFor(rem.user_id)
    const payload = JSON.stringify({
      title: rem.title,
      body: rem.body,
      url: rem.url,
      tag: `ct-reminder-${rem.id}`,
    })
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        )
        sent++
      } catch (err: unknown) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) stale.add(s.endpoint)
      }
    }
    // Mark sent regardless (at-most-once) so a missing subscription doesn't loop.
    processedIds.push(rem.id)
  }

  // Mark processed reminders sent.
  if (processedIds.length) {
    await fetch(`${supabaseUrl}/rest/v1/reminders?id=in.(${processedIds.join(',')})`, {
      method: 'PATCH',
      headers: { ...svc, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ sent_at: new Date().toISOString() }),
    })
  }

  // Admin activity digest — one consolidated push per admin with new activity
  // (the RPC also stamps their last-push time, so it never resends). Best-effort.
  let adminSent = 0
  try {
    const digRes = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_activity_digests`, {
      method: 'POST',
      headers: { ...svc, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (digRes.ok) {
      const digests = (await digRes.json()) as AdminDigest[]
      for (const d of digests) {
        const subs = await subsFor(d.user_id)
        const payload = JSON.stringify({
          title: `${d.total} new ${d.total === 1 ? 'thing' : 'things'} to review`,
          body: adminBody(d),
          url: '/app',
          tag: 'ct-admin-activity',
        })
        for (const s of subs) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
            adminSent++
          } catch (err: unknown) {
            const code = (err as { statusCode?: number })?.statusCode
            if (code === 404 || code === 410) stale.add(s.endpoint)
          }
        }
      }
    }
  } catch {
    /* admin digest is best-effort — never block reminders */
  }

  // Prune dead endpoints.
  for (const endpoint of stale) {
    await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: svc },
    )
  }

  res.status(200).json({ processed: processedIds.length, sent, adminSent })
}
