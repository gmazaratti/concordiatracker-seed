/**
 * POST /api/email-events: Resend's delivery/open/click webhooks.
 *
 * Rides on the stripe-webhook function (?source=resend) because the plan
 * allows twelve functions and that one already reads the raw body, which a
 * signature check needs. The two share nothing else.
 *
 * Only what parseResendEvent keeps is stored (db/product_analytics.sql →
 * record_email_event): no address, subject, link, IP or user agent. The
 * webhook delivery id is unique, so a retried delivery is counted once.
 *
 * Needs RESEND_WEBHOOK_SECRET (the `whsec_…` value from Resend → Webhooks).
 */
import { fail } from './_respond.js'
import { parseResendEvent, verifySvix } from './_svix.js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleResendWebhook(req: any, res: any, raw: Buffer): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !url || !service) {
    fail(res, 500, 'Email webhook is not configured.', { code: 'not_configured' })
    return
  }
  const body = raw.toString('utf8')
  const h = req.headers ?? {}
  const verdict = verifySvix(
    secret,
    { id: h['svix-id'], timestamp: h['svix-timestamp'], signature: h['svix-signature'] },
    body,
    Math.floor(Date.now() / 1000),
  )
  if (!verdict.ok) {
    fail(res, 401, `Webhook signature rejected: ${verdict.reason}.`, { code: 'unauthorized' })
    return
  }
  let parsed: ReturnType<typeof parseResendEvent>
  try {
    parsed = parseResendEvent(JSON.parse(body))
  } catch {
    fail(res, 400, 'Webhook body is not JSON.', { code: 'bad_request' })
    return
  }
  // An event type we do not count is acknowledged, or Resend retries it forever.
  if (!parsed) {
    res.status(200).json({ ok: true, stored: false })
    return
  }
  const r = await fetch(`${url}/rest/v1/rpc/record_email_event`, {
    method: 'POST',
    headers: { apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      p_webhook_id: String(h['svix-id']).slice(0, 100),
      p_email_id: parsed.emailId,
      p_template: parsed.template,
      p_event: parsed.event,
      p_user: parsed.userId,
      p_at: parsed.at,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)
  if (!r || !r.ok) {
    // A 5xx makes Resend retry, which is right: the event was real and not stored.
    fail(res, 503, 'Could not store the email event.', { code: 'upstream_error' })
    return
  }
  res.status(200).json({ ok: true, stored: (await r.json().catch(() => false)) === true })
}
