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

import { unsubUrl, type EmailList } from './_unsubscribe.js'

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const CONTACT = 'concordiatracker@gmail.com'

/** Brand tokens, duplicated here on purpose: an email cannot read a CSS custom
 *  property, and the values must not shift under a theme. */
const BRAND = {
  accent: '#46785a', // the LIGHT-theme accent — sage on white fails contrast
  ink: '#16181c',
  body: '#43474e',
  subtle: '#767b85',
  line: '#e3e5e8',
  canvas: '#f2f4f1',
  tint: '#f6f8f5',
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
  /**
   * Which kind of email this is (snake_case), sent to Resend as a tag so the
   * delivery/open/click webhook can be counted per template
   * (db/product_analytics.sql → email_events). Never the address or subject.
   */
  template: string
  /** The recipient's account, when there is one. Stored with the event only if they have not opted out of analytics. */
  userId?: string | null
  /** A small label at the top right, e.g. "Weekly digest · Nov 16". */
  eyebrow?: string
  /** The inbox preview line. Defaults to the first paragraph. */
  preheader?: string
  /** Deadlines as calendar rows (a day chip, the course, the title, the time). */
  agenda?: { day: string; date: string; course: string; title: string; time: string; urgent?: boolean }[]
  agendaLabel?: string
  /** More agenda sections under the first, e.g. your events, suggested events. */
  sections?: { label: string; note?: string; items: NonNullable<EmailOptions['agenda']> }[]
  /** One highlighted line with a red dot, e.g. "You have 3 unread notifications". */
  notice?: { text: string; link?: { label: string; href: string } }
  factsLabel?: string
  /** Signed by Alex, e.g. "Good luck this week,". For mail that should read like a person sent it. */
  signoff?: string
  /** A short postscript under the sign-off. */
  ps?: string
  /**
   * Marks a subscription email (CASL): adds a no-sign-in unsubscribe link in
   * the footer and the List-Unsubscribe headers Gmail turns into its own
   * button. Needs userId. Never set it on account email.
   */
  unsubscribe?: EmailList
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
  const unsub = o.unsubscribe && o.userId ? unsubUrl(o.userId, o.unsubscribe) : null
  const link = `color:${BRAND.subtle};text-decoration:underline;`
  const postal = process.env.EMAIL_POSTAL_ADDRESS?.trim()
  // Invisible filler after the preheader, so the inbox preview stops at our
  // sentence instead of running on into the footer text.
  const filler = '&#8199;&#847;'.repeat(60)

  /** A small label with a hairline running off to the right: the section break. */
  const rule = (label: string) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 12px;">
      <tr>
        <td style="white-space:nowrap;padding-right:12px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND.subtle};">${esc(label)}</td>
        <td width="100%" style="border-bottom:1px solid ${BRAND.line};font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>`

  const agendaRows = (list: NonNullable<EmailOptions['agenda']>) => list
    .map(
      (a, i) => `
      <tr>
        <td width="54" valign="top" style="padding:${i ? '12px' : '2px'} 0 12px;${i ? `border-top:1px dashed ${BRAND.line};` : ''}">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:46px;border:1px solid ${BRAND.line};border-radius:9px;background:${BRAND.card};">
            <tr><td align="center" style="padding:3px 0 1px;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${a.urgent ? '#c2410c' : BRAND.accent};border-bottom:1px solid ${BRAND.line};">${esc(a.day)}</td></tr>
            <tr><td align="center" style="padding:3px 0 4px;font-family:${FONT};font-size:19px;font-weight:700;color:${BRAND.ink};">${esc(a.date)}</td></tr>
          </table>
        </td>
        <td valign="top" style="padding:${i ? '13px' : '3px'} 0 12px 4px;${i ? `border-top:1px dashed ${BRAND.line};` : ''}font-family:${FONT};">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:${BRAND.accent};">${esc(a.course)}</div>
          <div style="font-size:15px;font-weight:600;color:${BRAND.ink};line-height:1.35;">${esc(a.title)}</div>
          <div style="font-size:13px;color:${a.urgent ? '#c2410c' : BRAND.subtle};">${esc(a.time)}</div>
        </td>
      </tr>`,
    )
    .join('')
  const agenda = agendaRows(o.agenda ?? [])

  const factRows = (o.facts ?? [])
    .map(
      (f, i) => `
        <tr>
          <td style="padding:10px 0;${i ? `border-top:1px dashed ${BRAND.line};` : ''}font-family:${FONT};font-size:14px;color:${BRAND.subtle};">${esc(f.label)}</td>
          <td style="padding:10px 0;${i ? `border-top:1px dashed ${BRAND.line};` : ''}font-family:${FONT};font-size:14px;color:${BRAND.ink};font-weight:600;text-align:right;">${esc(f.value)}</td>
        </tr>`,
    )
    .join('')

  // Reads like the end of a letter: the closing line at body size, then the
  // name on its own line. No avatar or job card, which made it look like an ad.
  const signoff = o.signoff
    ? `<p style="margin:30px 0 0;font-family:${FONT};font-size:16px;line-height:1.65;color:${BRAND.body};">${esc(o.signoff)}<br><span style="color:${BRAND.ink};font-weight:600;">- Alex, Founder</span></p>`
    : ''

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(o.subject)}</title>
<style>
  @media (max-width:520px){
    .ct-pad{padding:28px 22px !important}
    .ct-h1{font-size:24px !important}
    .ct-btn,.ct-btn td{width:100% !important}
    .ct-btn a{display:block !important;text-align:center !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(o.preheader ?? o.paragraphs[0] ?? '')}${filler}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};">
  <tr><td align="center" style="padding:32px 14px 28px;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

      <tr><td style="padding:0 6px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td>
            <a href="${SITE}" style="text-decoration:none;font-family:${FONT};font-size:17px;font-weight:700;color:${BRAND.ink};letter-spacing:-0.01em;">
              <img src="${SITE}/icon-192.png" width="28" height="28" alt="" style="display:inline-block;width:28px;height:28px;border:0;border-radius:8px;vertical-align:middle;margin-right:9px;" /><span style="vertical-align:middle;">ConcordiaTracker</span>
            </a>
          </td>
          ${
            o.eyebrow
              ? `<td align="right" style="font-family:${FONT};font-size:12px;color:${BRAND.subtle};white-space:nowrap;">${esc(o.eyebrow)}</td>`
              : ''
          }
        </tr></table>
      </td></tr>

      <tr><td class="ct-pad" style="background:${BRAND.card};border:1px solid ${BRAND.line};border-radius:20px;padding:36px 38px 34px;">
        <h1 class="ct-h1" style="margin:0 0 14px;font-family:${FONT};font-size:27px;line-height:1.2;font-weight:800;color:${BRAND.ink};letter-spacing:-0.025em;">
          ${esc(o.heading)}
        </h1>
        ${o.paragraphs
          .map(
            (p) =>
              `<p style="margin:0 0 14px;font-family:${FONT};font-size:16px;line-height:1.65;color:${BRAND.body};">${esc(p)}</p>`,
          )
          .join('')}

        ${agenda ? `${rule(o.agendaLabel ?? 'Coming up')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${agenda}</table>` : ''}

        ${(o.sections ?? [])
          .filter((x) => x.items.length)
          .map(
            (x) =>
              `${rule(x.label)}${x.note ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;color:${BRAND.subtle};">${esc(x.note)}</p>` : ''}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${agendaRows(x.items)}</table>`,
          )
          .join('')}

        ${
          o.notice
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 0;background:${BRAND.tint};border:1px solid ${BRAND.line};border-radius:12px;">
                 <tr><td style="padding:13px 16px;font-family:${FONT};font-size:14px;color:${BRAND.ink};">
                   <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;vertical-align:middle;margin-right:8px;"></span>${esc(o.notice.text)}
                   ${o.notice.link ? ` <a href="${esc(o.notice.link.href)}" style="color:${BRAND.accent};font-weight:700;text-decoration:none;">${esc(o.notice.link.label)}</a>` : ''}
                 </td></tr>
               </table>`
            : ''
        }

        ${factRows ? `${rule(o.factsLabel ?? 'Details')}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${factRows}</table>` : ''}

        ${
          o.button
            ? `<table role="presentation" class="ct-btn" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
                 <tr><td style="border-radius:999px;background:${BRAND.ink};">
                   <a href="${esc(o.button.href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px;">${esc(o.button.label)}</a>
                 </td></tr>
               </table>`
            : ''
        }

        ${signoff}

        ${
          o.ps
            ? `<p style="margin:26px 0 0;padding:14px 16px;background:${BRAND.tint};border-radius:12px;font-family:${FONT};font-size:14px;line-height:1.6;color:${BRAND.body};"><strong style="color:${BRAND.ink};">P.S.</strong> ${esc(o.ps)}</p>`
            : ''
        }

        ${
          o.footnote
            ? `<p style="margin:22px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${BRAND.subtle};">${esc(o.footnote)}</p>`
            : ''
        }
      </td></tr>

      <tr><td align="center" style="padding:22px 12px 0;font-family:${FONT};font-size:12px;line-height:1.8;color:${BRAND.subtle};">
        ${unsub ? `You are getting this because it is on in your settings. <a href="${esc(unsub)}" style="${link}">Unsubscribe</a><br>` : ''}
        <a href="${SITE}/privacy" style="${link}">Privacy</a>
        &nbsp;·&nbsp;
        <a href="${SITE}/terms" style="${link}">Terms</a>
        &nbsp;·&nbsp;
        <a href="mailto:${CONTACT}" style="${link}">${CONTACT}</a>
        <br>
        ConcordiaTracker${postal ? `, ${esc(postal)}` : ''}. Made in Montreal. Not affiliated with Concordia University.
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
  if (o.agenda?.length) {
    lines.push('')
    for (const x of o.agenda) lines.push(`${x.day} ${x.date}  ${x.course}  ${x.title}  (${x.time})`)
  }
  if (o.button) lines.push('', `${o.button.label}: ${o.button.href}`)
  for (const x of o.sections ?? []) {
    if (!x.items.length) continue
    lines.push('', x.label.toUpperCase())
    for (const i of x.items) lines.push(`${i.day} ${i.date}  ${i.course}  ${i.title}  (${i.time})`)
  }
  if (o.notice) lines.push('', o.notice.text + (o.notice.link ? ` ${o.notice.link.href}` : ''))
  if (o.signoff) lines.push('', o.signoff, '- Alex, Founder')
  if (o.ps) lines.push('', `P.S. ${o.ps}`)
  if (o.footnote) lines.push('', o.footnote)
  // Plain hyphens, not an em dash: em dashes in email copy read as machine-
  // written to a lot of people, and the separator is the one that ships.
  const unsub = o.unsubscribe && o.userId ? unsubUrl(o.userId, o.unsubscribe) : null
  if (unsub) lines.push('', `Unsubscribe: ${unsub}`)
  lines.push('', '--', 'ConcordiaTracker is not affiliated with Concordia University.', SITE, CONTACT)
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
/** Resend allows ASCII letters, digits, `_` and `-` in tag values; anything else is dropped, not sent. */
export function emailTags(o: Pick<EmailOptions, 'template' | 'userId'>): { name: string; value: string }[] {
  const tags = [{ name: 'template', value: typeof o.template === 'string' && /^[a-z0-9_]{1,40}$/.test(o.template) ? o.template : 'other' }]
  if (o.userId && /^[0-9a-f-]{36}$/i.test(o.userId)) tags.push({ name: 'uid', value: o.userId })
  return tags
}

/** RFC 8058 one-click headers, so Gmail and Apple Mail show their own Unsubscribe. */
function unsubHeader(o: EmailOptions): Record<string, string> | null {
  const url = o.unsubscribe && o.userId ? unsubUrl(o.userId, o.unsubscribe) : null
  if (!url) return null
  return {
    'List-Unsubscribe': `<${url}>, <mailto:${CONTACT}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

export async function sendEmail(o: EmailOptions): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY is not set, skipping', o.subject)
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
        tags: emailTags(o),
        ...(unsubHeader(o) ? { headers: unsubHeader(o) } : {}),
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
