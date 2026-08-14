/**
 * POST /api/ticket — the signed-out support path, used by the docs.
 *
 * The docs are static HTML with no Supabase session, so submissions can't go
 * through RLS as a user. They run here with the service role instead, which is
 * also the only place rate limiting can live: granting `anon` an insert policy
 * on tickets would be an open spam faucet with no throttle.
 *
 * Actions:
 *   submit → create a ticket, return { case_id, lookup_token }
 *   check  → fetch a thread by case id + token
 *   reply  → append a message to a thread by case id + token
 *
 * The token is the whole security model here: a case id alone reveals nothing,
 * so a guessed TKT-1002 can't read someone else's conversation.
 */

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_PER_WINDOW = 3

/**
 * In-memory throttle, keyed by IP. Serverless instances are recycled and there
 * can be several at once, so this is a speed bump rather than a wall — enough to
 * stop a naive loop. If real abuse shows up this needs to move to a table with a
 * unique index on (ip, hour).
 */
const hits = new Map<string, number[]>()

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear() // crude bound; this map must not grow forever
  return recent.length > MAX_PER_WINDOW
}

function clientIp(req: { headers: Record<string, string | string[] | undefined> }): string {
  const raw = req.headers['x-forwarded-for']
  const value = Array.isArray(raw) ? raw[0] : raw
  return (value ?? '').split(',')[0].trim() || 'unknown'
}

async function rpc(name: string, body: unknown): Promise<Response> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Support is not configured on the server.')
  return fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

interface Body {
  action?: 'submit' | 'check' | 'reply'
  subject?: string
  message?: string
  category?: string
  email?: string
  name?: string
  page?: string
  caseId?: string
  token?: string
  /** Honeypot — a real person never fills a hidden field. */
  website?: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  // The docs are served from the same origin, so no CORS dance is needed.
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  let body: Body = {}
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {})
  } catch {
    res.status(400).json({ error: 'Malformed request.' })
    return
  }

  try {
    if (body.action === 'check' || body.action === 'reply') {
      const caseId = (body.caseId ?? '').trim()
      const token = (body.token ?? '').trim()
      if (!caseId || !token) {
        res.status(400).json({ error: 'A case number and its link are both required.' })
        return
      }

      if (body.action === 'reply') {
        if (rateLimited(clientIp(req))) {
          res.status(429).json({ error: 'Too many messages just now. Try again shortly.' })
          return
        }
        const r = await rpc('reply_ticket_by_token', {
          p_case_id: caseId,
          p_token: token,
          p_body: body.message ?? '',
        })
        if (!r.ok) {
          res.status(400).json({ error: 'Could not add that message.' })
          return
        }
        const ok = await r.json()
        if (ok !== true) {
          res.status(404).json({ error: 'No ticket matches that case number and link.' })
          return
        }
      }

      const r = await rpc('ticket_by_token', { p_case_id: caseId, p_token: token })
      if (!r.ok) {
        res.status(500).json({ error: 'Could not look that up.' })
        return
      }
      const rows = (await r.json()) as unknown[]
      if (!rows.length) {
        res.status(404).json({ error: 'No ticket matches that case number and link.' })
        return
      }
      res.status(200).json({ ticket: rows[0] })
      return
    }

    // ── submit ──────────────────────────────────────────────────────────────
    // Silently accept-and-drop honeypot hits: telling a bot it failed just
    // teaches it to try again without the field.
    if (body.website) {
      res.status(200).json({ caseId: 'TKT-0000', token: '' })
      return
    }
    if (rateLimited(clientIp(req))) {
      res.status(429).json({ error: 'Too many tickets from here recently. Try again in an hour.' })
      return
    }

    const r = await rpc('submit_ticket', {
      p_subject: body.subject ?? '',
      p_body: body.message ?? '',
      p_category: body.category ?? 'other',
      p_email: body.email ?? '',
      p_name: body.name ?? '',
      p_source: 'docs',
      p_context: {
        page: (body.page ?? '').slice(0, 300),
        ua: String(req.headers['user-agent'] ?? '').slice(0, 300),
      },
    })

    if (!r.ok) {
      // Postgres RAISE messages are written for humans, so pass them through —
      // "a valid email address is required" is more useful than "bad request".
      const detail = (await r.json().catch(() => null)) as { message?: string } | null
      res.status(400).json({ error: detail?.message ?? 'Could not create that ticket.' })
      return
    }

    const rows = (await r.json()) as { case_id: string; lookup_token: string }[]
    const row = rows[0]
    res.status(200).json({ caseId: row.case_id, token: row.lookup_token })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Something went wrong.' })
  }
}
