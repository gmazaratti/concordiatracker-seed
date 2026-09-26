/**
 * node api/_svix.test.mjs
 *
 * The signature check is the only thing between the public internet and a
 * table of email events, and the parser is the only thing deciding what of a
 * webhook payload is kept. Both are tested here, against the published Svix
 * scheme and payloads shaped like Resend's.
 */
import { execSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = path.join(here, '.svix.test.tmp.mjs')
execSync(`npx esbuild "${path.join(here, '_svix.ts')}" --format=esm --platform=node --outfile="${out}"`, { stdio: 'pipe' })
const { verifySvix, svixSignature, parseResendEvent, RESEND_EVENTS } = await import(pathToFileURL(out).href)

let failures = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`)
  if (!ok) failures++
}

const secret = 'whsec_' + Buffer.from('a-test-secret-of-some-length!!').toString('base64')
const body = '{"type":"email.delivered"}'
const now = 1_790_000_000
const ts = String(now)
// Independent computation, not the module's own function, so a bug in it cannot agree with itself.
const good = createHmac('sha256', Buffer.from(secret.slice(6), 'base64')).update(`msg_1.${ts}.${body}`).digest('base64')

check('module signature matches an independent HMAC', svixSignature(secret, 'msg_1', ts, body) === good)
check('valid signature passes', verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,${good}` }, body, now).ok)
check('one of several signatures (rotation) passes', verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,AAAA v1,${good}` }, body, now).ok)
check('tampered body fails', !verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,${good}` }, body + ' ', now).ok)
check('other message id fails', !verifySvix(secret, { id: 'msg_2', timestamp: ts, signature: `v1,${good}` }, body, now).ok)
check('wrong secret fails', !verifySvix('whsec_' + Buffer.from('other').toString('base64'), { id: 'msg_1', timestamp: ts, signature: `v1,${good}` }, body, now).ok)
check('old timestamp (replay) fails', !verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,${good}` }, body, now + 301).ok)
check('future timestamp fails', !verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v1,${good}` }, body, now - 301).ok)
check('missing headers fail', !verifySvix(secret, { id: 'msg_1', timestamp: ts }, body, now).ok)
check('unknown version ignored', !verifySvix(secret, { id: 'msg_1', timestamp: ts, signature: `v2,${good}` }, body, now).ok)

const uid = '33512c0e-3586-4582-8a35-e2cbabe15512'
const clicked = {
  type: 'email.clicked',
  created_at: '2026-09-26T12:00:00Z',
  data: {
    email_id: 'em_123',
    to: ['student@gmail.com'],
    subject: 'Re: my grades (TKT-1001)',
    tags: { template: 'support_reply', uid },
    click: { ipAddress: '203.0.113.9', userAgent: 'Mozilla/5.0', link: 'https://concordiatracker.com/docs/support-status?case=TKT-1001&token=secret' },
  },
}
const p = parseResendEvent(clicked)
check('click parsed', p?.event === 'clicked' && p.emailId === 'em_123' && p.template === 'support_reply' && p.userId === uid)
const kept = JSON.stringify(p)
check('no address kept', !kept.includes('student@'))
check('no subject kept', !kept.includes('TKT-1001') && !kept.includes('grades'))
check('no link, token, IP or UA kept', !/secret|203\.0\.113|Mozilla|http/.test(kept))
check('array-shaped tags read', parseResendEvent({ type: 'email.opened', data: { email_id: 'e', tags: [{ name: 'template', value: 'club_invite' }] } })?.template === 'club_invite')
check('untagged auth email recognised by subject', parseResendEvent({ type: 'email.delivered', data: { email_id: 'e', subject: 'Reset your ConcordiaTracker password' } })?.template === 'auth_password_reset')
check('unknown untagged email is other', parseResendEvent({ type: 'email.delivered', data: { email_id: 'e', subject: 'Hello' } })?.template === 'other')
check('malformed uid dropped', parseResendEvent({ type: 'email.sent', data: { email_id: 'e', tags: { template: 'x', uid: 'not-a-uuid' } } })?.userId === null)
check('odd template name becomes other', parseResendEvent({ type: 'email.sent', data: { email_id: 'e', tags: { template: 'Bad Name' } } })?.template === 'other')
check('unknown event type ignored', parseResendEvent({ type: 'contact.created', data: { email_id: 'e' } }) === null)
check('missing email id ignored', parseResendEvent({ type: 'email.sent', data: {} }) === null)
check('eight event types mapped', Object.keys(RESEND_EVENTS).length === 8)

console.log(failures ? `\n${failures} failed` : '\nall svix/resend checks passed')
process.exit(failures ? 1 : 0)
