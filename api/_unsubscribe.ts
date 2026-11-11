/**
 * One-click unsubscribe for the two emails that need one (CASL): the weekly
 * digest and product updates. Account emails (confirm, password, receipts,
 * support replies) are transactional and carry no unsubscribe.
 *
 * The link works WITHOUT signing in, which is the point: "turn it off in
 * Settings" is not a working unsubscribe. It carries the account id, the list,
 * and an HMAC of the two, so nobody can unsubscribe someone else by editing the
 * address.
 *
 *   GET  /api/unsubscribe?u=&l=&t=   a small page with a button (link scanners
 *                                    follow GETs, so a GET never changes anything)
 *   POST /api/unsubscribe?u=&l=&t=   does it. Also what Gmail's own Unsubscribe
 *                                    button sends (RFC 8058 one-click).
 *
 * Routed through api/ticket.ts (?unsub=1) because the Hobby plan caps us at
 * twelve functions.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

export type EmailList = 'digest' | 'product'

const SITE = 'https://concordiatracker.com'
const COLUMN: Record<EmailList, string> = { digest: 'email_digest', product: 'email_product' }
const NAME: Record<EmailList, string> = { digest: 'the weekly digest', product: 'product update emails' }

function secret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || null
}

export function unsubToken(userId: string, list: EmailList, key: string): string {
  return createHmac('sha256', key).update(`unsub:${userId}:${list}`).digest('base64url').slice(0, 32)
}

/** The link for an email footer and the List-Unsubscribe header, or null without a secret. */
export function unsubUrl(userId: string, list: EmailList): string | null {
  const key = secret()
  if (!key || !/^[0-9a-f-]{36}$/i.test(userId)) return null
  return `${SITE}/api/unsubscribe?u=${userId}&l=${list}&t=${unsubToken(userId, list, key)}`
}

function valid(u: string, l: string, t: string): l is EmailList {
  const key = secret()
  if (!key || !/^[0-9a-f-]{36}$/i.test(u) || (l !== 'digest' && l !== 'product')) return false
  const want = Buffer.from(unsubToken(u, l, key))
  const got = Buffer.from(t)
  return want.length === got.length && timingSafeEqual(want, got)
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>
body{margin:0;background:#f5f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#16181c}
main{max-width:440px;margin:12vh auto 0;padding:0 16px}
.card{background:#fff;border:1px solid #e3e5e8;border-radius:16px;padding:28px}
h1{font-size:21px;margin:0 0 10px}p{font-size:15px;line-height:1.6;color:#43474e;margin:0 0 14px}
button,.btn{display:inline-block;border:0;border-radius:10px;background:#46785a;color:#fff;font-size:15px;font-weight:600;padding:12px 22px;text-decoration:none;cursor:pointer}
.muted{font-size:13px;color:#767b85}a{color:#46785a}
</style></head><body><main><p style="font-weight:700;font-size:16px;margin-bottom:16px">ConcordiaTracker</p><div class="card">${body}</div></main></body></html>`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleUnsubscribe(req: any, res: any): Promise<void> {
  const q = req.query ?? {}
  const u = String(q.u ?? '')
  const l = String(q.l ?? '')
  const t = String(q.t ?? '')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')

  if (!valid(u, l, t)) {
    res.status(400).send(
      page('Link not valid', `<h1>That link did not work</h1><p>It may have been cut off by your email app. You can turn emails off any time in <a href="${SITE}/app?settings=general">Settings</a>.</p>`),
    )
    return
  }

  if (req.method === 'GET') {
    const self = `/api/unsubscribe?u=${u}&l=${l}&t=${encodeURIComponent(t)}`
    res.status(200).send(
      page('Unsubscribe', `<h1>Stop ${NAME[l]}?</h1><p>You will not get ${NAME[l]} any more. Emails about your account, like password resets, still come.</p>
<form method="post" action="${esc(self)}"><button type="submit">Unsubscribe</button></form>`),
    )
    return
  }
  if (req.method !== 'POST') {
    res.status(405).send(page('Not allowed', '<h1>Not allowed</h1>'))
    return
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let ok = false
  if (url && key) {
    const r = await fetch(`${url}/rest/v1/user_profile?user_id=eq.${u}`, {
      method: 'PATCH',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ [COLUMN[l]]: false }),
    }).catch(() => null)
    ok = !!r?.ok
  }
  if (!ok) {
    res.status(500).send(
      page('Try again', `<h1>That did not save</h1><p>Please try again in a minute, or turn it off in <a href="${SITE}/app?settings=general">Settings</a>.</p>`),
    )
    return
  }
  res.status(200).send(
    page('Unsubscribed', `<h1>You are unsubscribed</h1><p>You will not get ${NAME[l]} any more.</p><p class="muted">Changed your mind? Turn it back on in <a href="${SITE}/app?settings=general">Settings</a>.</p>`),
  )
}
