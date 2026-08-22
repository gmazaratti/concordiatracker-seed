/**
 * Transactional email, in our own voice.
 *
 * Sent through Resend's REST API with `fetch` rather than the SDK. The SDK
 * exists to wrap one POST, and every dependency on the serverless path is
 * another thing to keep patched and another cold-start import — `web-push` and
 * `stripe` earn their place because they do real work; this does not.
 *
 * THE TEMPLATE IS LIGHT, DELIBERATELY. The app is dark by default and the
 * instinct is to match it, but a dark email is the wrong call: Gmail and
 * Outlook both recolour backgrounds unpredictably, several clients strip the
 * background entirely and leave pale text on white, and Gmail clips messages
 * over 102KB. A light shell with our accent on the button survives all of that
 * and still reads as ours.
 *
 * Everything is table-based with inline styles for the same reason — Outlook
 * renders through Word, which has no flexbox, no grid, and no external CSS.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** Brand tokens, duplicated here on purpose: an email cannot read a CSS custom
 *  property, and the values must not shift under a theme. */
const BRAND = {
  accent: '#46785a', // the LIGHT-theme accent — sage on white fails contrast
  ink: '#16181c',
  body: '#43474e',
  subtle: '#767b85',
  line: '#e3e5e8',
  canvas: '#f5f6f4',
  card: '#ffffff',
}

const FONT =
  "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

export interface EmailButton {
  label: string
  href: string
}

export interface EmailOptions {
  to: string
  subject: string
  /** The big line at the top of the card. Keep it a statement, not a greeting. */
  heading: string
  /** Body paragraphs, plain strings. Rendered in order. */
  paragraphs: string[]
  button?: EmailButton
  /** Label/value rows in a bordered box — an amount, a date, a case number. */
  facts?: { label: string; value: string }[]
  /** A quiet line under the button, e.g. how to cancel. */
  footnote?: string
  /** Overrides the plain-text part, which is otherwise derived from the above. */
  text?: string
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const SITE = 'https://concordiatracker.com'

/**
 * The shell every message shares.
 *
 * One template rather than a file per email: the day the footer needs a new
 * link or the accent changes, it changes once, and no message is left behind
 * looking like it came from a different company.
 */
export function renderEmail(o: EmailOptions): string {
  const factRows = (o.facts ?? [])
    .map(
      (f) => `
        <tr>
          <td style="padding:7px 0;font-size:14px;color:${BRAND.subtle};">${esc(f.label)}</td>
          <td style="padding:7px 0;font-size:14px;color:${BRAND.ink};font-weight:600;text-align:right;">${esc(f.value)}</td>
        </tr>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(o.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
<!-- Preheader: the grey line the inbox shows next to the subject. Left to the
     first paragraph rather than invented, so it can never contradict the body. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.paragraphs[0] ?? '')}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};">
  <tr><td align="center" style="padding:32px 16px;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

      <tr><td style="padding:0 4px 18px;">
        <a href="${SITE}" style="text-decoration:none;font-family:${FONT};font-size:17px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.01em;">
          <span style="display:inline-block;width:9px;height:9px;border-radius:9px;background:${BRAND.accent};margin-right:8px;"></span>ConcordiaTracker
        </a>
      </td></tr>

      <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:14px;padding:30px 28px;">
        <h1 style="margin:0 0 14px;font-family:${FONT};font-size:21px;line-height:1.3;font-weight:600;color:${BRAND.ink};letter-spacing:-0.01em;">
          ${esc(o.heading)}
        </h1>
        ${o.paragraphs
          .map(
            (p) =>
              `<p style="margin:0 0 13px;font-family:${FONT};font-size:15px;line-height:1.6;color:${BRAND.body};">${esc(p)}</p>`,
          )
          .join('')}

        ${
          factRows
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0 4px;border-top:1px solid ${BRAND.line};border-bottom:1px solid ${BRAND.line};font-family:${FONT};">${factRows}</table>`
            : ''
        }

        ${
          o.button
            ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;">
                 <tr><td style="border-radius:9px;background:${BRAND.accent};">
                   <a href="${esc(o.button.href)}" style="display:inline-block;padding:11px 22px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:9px;">${esc(o.button.label)}</a>
                 </td></tr>
               </table>`
            : ''
        }

        ${
          o.footnote
            ? `<p style="margin:18px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.subtle};">${esc(o.footnote)}</p>`
            : ''
        }
      </td></tr>

      <tr><td style="padding:18px 4px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${BRAND.subtle};">
        <a href="${SITE}/privacy" style="color:${BRAND.subtle};text-decoration:underline;">Privacy</a>
        &nbsp;·&nbsp;
        <a href="${SITE}/terms" style="color:${BRAND.subtle};text-decoration:underline;">Terms</a>
        &nbsp;·&nbsp;
        <a href="${SITE}/docs/support" style="color:${BRAND.subtle};text-decoration:underline;">Support</a>
        <br>
        ConcordiaTracker is not affiliated with Concordia University.
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`
}

/** The plain-text part. Not optional: a message with no text alternative scores
 *  worse with spam filters and is unreadable in a text-only client. */
function renderText(o: EmailOptions): string {
  const lines = [o.heading, '', ...o.paragraphs]
  if (o.facts?.length) {
    lines.push('')
    for (const f of o.facts) lines.push(`${f.label}: ${f.value}`)
  }
  if (o.button) lines.push('', `${o.button.label}: ${o.button.href}`)
  if (o.footnote) lines.push('', o.footnote)
  lines.push('', '—', 'ConcordiaTracker is not affiliated with Concordia University.', SITE)
  return lines.join('\n')
}

/**
 * Send one message.
 *
 * Returns false rather than throwing. Every caller is a side effect of
 * something that already succeeded — a payment synced, a ticket answered — and
 * failing that operation because an email bounced would turn a small problem
 * into a real one. The failure is logged; the caller carries on.
 */
export async function sendEmail(o: EmailOptions): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY is not set — skipping', o.subject)
    return false
  }
  // A verified domain is required to send to anyone but the account owner, so
  // the default is the real address and the env var is the escape hatch while
  // DNS propagates.
  const from = process.env.EMAIL_FROM ?? 'ConcordiaTracker <noreply@concordiatracker.com>'

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: o.to,
        subject: o.subject,
        html: renderEmail(o),
        text: o.text ?? renderText(o),
        reply_to: process.env.EMAIL_REPLY_TO ?? 'concordiatracker@gmail.com',
      }),
    })
    if (!res.ok) {
      console.error('[email] resend rejected', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[email] send failed', err)
    return false
  }
}

/** Money, the way a person reads it. Stripe counts in cents. */
export function formatAmount(cents: number, currency = 'cad'): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100)
}

/** A date, spelled out. "2026-09-14" in an email about money is a support ticket. */
export function formatEmailDate(unixSeconds: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(unixSeconds * 1000))
}
