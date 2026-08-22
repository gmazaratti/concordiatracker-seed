/**
 * Send yourself the branded template, so it can be checked in a real inbox.
 *
 *   node --env-file=.env.local scripts/send-test-email.mjs you@example.com
 *
 * An email that looks right in a browser can still break in Gmail, which
 * rewrites CSS, and in Outlook, which renders through Word. The only useful
 * test is the one that arrives.
 *
 * Deliberately a script and not an endpoint: a /api/email-test route is an open
 * relay wearing a lab coat.
 */
import { renderEmail, sendEmail, formatAmount, formatEmailDate } from '../api/_email.ts'
import { writeFileSync } from 'node:fs'

const to = process.argv[2]
if (!to) {
  console.error('usage: node --env-file=.env.local scripts/send-test-email.mjs you@example.com')
  process.exit(1)
}

const renewsAt = Math.floor(Date.now() / 1000) + 7 * 86400
const message = {
  to,
  subject: `Your ConcordiaTracker pass renews on ${formatEmailDate(renewsAt)}`,
  heading: 'Your pass renews soon',
  paragraphs: [
    'This is the heads-up we promise in our Terms, so a renewal never arrives as a surprise on your statement.',
    'Nothing to do if you want to keep going — it renews on its own.',
  ],
  facts: [
    { label: 'Amount', value: formatAmount(1500, 'cad') },
    { label: 'Renews', value: formatEmailDate(renewsAt) },
  ],
  button: { label: 'Manage your plan', href: 'https://concordiatracker.com/app?settings=billing' },
  footnote:
    'Cancel any time before that date and you keep access until the end of the period you have already paid for. If it renews and you would rather it had not, you have 14 days to ask for a full refund — just reply to this email.',
}

// Written out too, so the markup can be eyeballed without burning a send.
writeFileSync('email-preview.html', renderEmail(message))
console.log('wrote email-preview.html')

const ok = await sendEmail(message)
console.log(ok ? `sent to ${to}` : 'not sent — see the warning above')
process.exit(ok ? 0 : 1)
