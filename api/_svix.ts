/**
 * Verify a webhook signed the Svix way, which is how Resend signs its webhooks.
 *
 * Signed content is `${svix-id}.${svix-timestamp}.${raw body}`, HMAC-SHA256
 * keyed with the base64 part of the `whsec_…` secret. The `svix-signature`
 * header carries one or more space-separated `v1,<base64>` entries (more than
 * one while a secret is being rotated); any match passes. Timestamps more than
 * five minutes away are refused, so a captured delivery cannot be replayed.
 *
 * Pure (node:crypto only) so it is tested without a server.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'

const TOLERANCE_S = 5 * 60

export function svixSignature(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  return createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')
}

export function verifySvix(
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  body: string,
  nowSeconds: number,
): { ok: true } | { ok: false; reason: string } {
  const { id, timestamp, signature } = headers
  if (!id || !timestamp || !signature) return { ok: false, reason: 'missing signature headers' }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_S) {
    return { ok: false, reason: 'timestamp outside tolerance' }
  }
  const expected = Buffer.from(svixSignature(secret, id, timestamp, body))
  for (const part of signature.split(' ')) {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) continue
    const given = Buffer.from(sig)
    if (given.length === expected.length && timingSafeEqual(given, expected)) return { ok: true }
  }
  return { ok: false, reason: 'signature mismatch' }
}

/** Resend event type to our event word. Anything else is ignored. */
export const RESEND_EVENTS: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delivery_delayed',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.failed': 'failed',
}

/**
 * Supabase's auth emails arrive untagged if they go through Resend's SMTP.
 * They are recognised by their subject (the ones scripts/auth-email-templates
 * writes), and the subject is then discarded.
 */
const AUTH_SUBJECTS: [RegExp, string][] = [
  [/^confirm your email/i, 'auth_confirm_signup'],
  [/sign-in link/i, 'auth_magic_link'],
  [/reset your .*password/i, 'auth_password_reset'],
  [/confirm your new email/i, 'auth_email_change'],
  [/confirmation code/i, 'auth_otp'],
]

type Tags = Record<string, string> | { name: string; value: string }[] | undefined

function tagValue(tags: Tags, name: string): string | null {
  if (!tags) return null
  if (Array.isArray(tags)) return tags.find((t) => t?.name === name)?.value ?? null
  const v = (tags as Record<string, unknown>)[name]
  return typeof v === 'string' ? v : null
}

/**
 * What we keep from one webhook payload: the email id, the template, the
 * account id if the send carried one, the event and its time. The recipient
 * address, the subject, the clicked link, and the IP and user agent Resend
 * reports for opens and clicks are all dropped here, before anything is stored.
 */
export function parseResendEvent(payload: unknown): {
  event: string
  emailId: string
  template: string
  userId: string | null
  at: string | null
} | null {
  const p = payload as { type?: string; created_at?: string; data?: Record<string, unknown> } | null
  const event = p?.type ? RESEND_EVENTS[p.type] : undefined
  const data = p?.data
  const emailId = typeof data?.email_id === 'string' ? data.email_id : null
  if (!event || !emailId) return null
  const tags = data?.tags as Tags
  let template = tagValue(tags, 'template')
  if (!template) {
    const subject = typeof data?.subject === 'string' ? data.subject : ''
    template = AUTH_SUBJECTS.find(([re]) => re.test(subject))?.[1] ?? 'other'
  }
  const uid = tagValue(tags, 'uid')
  return {
    event,
    emailId: emailId.slice(0, 100),
    template: /^[a-z0-9_]{1,40}$/.test(template) ? template : 'other',
    userId: uid && /^[0-9a-f-]{36}$/i.test(uid) ? uid : null,
    at: typeof p?.created_at === 'string' ? p.created_at : null,
  }
}
