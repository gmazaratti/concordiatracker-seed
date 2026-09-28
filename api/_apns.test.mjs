/**
 * The APNs half that can be checked without Apple:
 *
 *   node api/_apns.test.mjs
 *
 * The signature is the part worth testing. A JWT signed as DER instead of raw
 * r||s is rejected by Apple with a bare 403, and the only way to find that out
 * otherwise is on a real device after the first TestFlight build.
 */
import { generateKeyPairSync, verify, createPublicKey } from 'node:crypto'
import {
  apnsBody,
  apnsHeaders,
  apnsJwt,
  apnsToken,
  classifyApns,
  liveActivityHeaders,
  liveActivityStartBody,
  normalisePem,
} from './_apns.ts'

let failures = 0
function check(label, ok, detail) {
  if (ok) console.log(`  ok    ${label}`)
  else {
    failures++
    console.log(`  FAIL  ${label}${detail ? `\n         ${detail}` : ''}`)
  }
}

const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const pub = createPublicKey(privateKey)
const unb64 = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

console.log('\nprovider token')
{
  const jwt = apnsJwt(pem, 'KEY123ABCD', 'TEAM987XYZ', 1_800_000_000)
  const [h, c, sig] = jwt.split('.')
  const header = JSON.parse(unb64(h).toString())
  const claims = JSON.parse(unb64(c).toString())
  check('three parts', jwt.split('.').length === 3)
  check('header is ES256 with the key id', header.alg === 'ES256' && header.kid === 'KEY123ABCD')
  check('claims carry the team id and issue time', claims.iss === 'TEAM987XYZ' && claims.iat === 1_800_000_000)
  check('no padding in any part', !/=/.test(jwt))
  const raw = unb64(sig)
  check('signature is raw r||s (64 bytes), not DER', raw.length === 64, `got ${raw.length} bytes`)
  const good = verify('sha256', Buffer.from(`${h}.${c}`), { key: pub, dsaEncoding: 'ieee-p1363' }, raw)
  check('signature verifies with the public key', good)
}

console.log('\nkeys as they arrive through an environment variable')
{
  const escaped = pem.replace(/\n/g, '\\n')
  const bare = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')
  check('literal \\n is turned back into newlines', normalisePem(escaped) === normalisePem(pem))
  check('a bare base64 body is framed', normalisePem(bare).startsWith('-----BEGIN PRIVATE KEY-----\n'))
  let signed = true
  try {
    apnsJwt(escaped, 'K', 'T', 1)
    apnsJwt(bare, 'K', 'T', 1)
  } catch {
    signed = false
  }
  check('both forms can sign', signed)
}

console.log('\ntoken reuse')
{
  const a = apnsToken(pem, 'K1', 'T', 1000)
  const b = apnsToken(pem, 'K1', 'T', 1000 + 49 * 60)
  const c = apnsToken(pem, 'K1', 'T', 1000 + 51 * 60)
  check('reused inside 50 minutes', a === b)
  check('re-signed after 50 minutes', c !== a)
  check('a different key id re-signs', apnsToken(pem, 'K2', 'T', 1000 + 51 * 60) !== c)
}

console.log('\nwhat an answer means')
{
  check('200 is ok', classifyApns(200) === 'ok')
  check('410 is gone', classifyApns(410, 'Unregistered') === 'gone')
  check('BadDeviceToken tries the other environment', classifyApns(400, 'BadDeviceToken') === 'wrong-env')
  check('a topic mismatch is not deleted', classifyApns(400, 'DeviceTokenNotForTopic') === 'error')
  check('a 500 is an error, not gone', classifyApns(500, 'InternalServerError') === 'error')
}

console.log('\nthe request')
{
  const body = JSON.parse(apnsBody({ title: 'Seat open', body: 'COMP 248', url: '/app/courses', tag: 't1' }))
  check('alert has title and body', body.aps.alert.title === 'Seat open' && body.aps.alert.body === 'COMP 248')
  check('url rides outside aps for the tap handler', body.url === '/app/courses' && !('url' in body.aps))
  check('tag becomes the thread id', body.aps['thread-id'] === 't1')
  const titleOnly = JSON.parse(apnsBody({ title: 'Hi' }))
  check('no body means no empty body key', !('body' in titleOnly.aps.alert))
  const h = apnsHeaders('TOKEN', 'com.concordiatracker.app', 'abcd', { title: 'x', tag: 'z'.repeat(100) })
  check('path targets the device', h[':path'] === '/3/device/abcd')
  check('topic is the bundle id', h['apns-topic'] === 'com.concordiatracker.app')
  check('push type is alert', h['apns-push-type'] === 'alert')
  check('collapse id capped at 64 bytes', Buffer.byteLength(h['apns-collapse-id']) <= 64)
}

{
  // Push-to-start: must decode into DeadlineActivityAttributes on the phone.
  const body = JSON.parse(
    liveActivityStartBody(
      {
        assessmentId: 'a1', title: 'Assignment 1', course: 'COMM 305', colorHex: '#3b82f6',
        path: '/app/courses/c1?focus=a1', dueEpoch: 1790000000.5, alertTitle: 'T', alertBody: 'B',
      },
      1789990000,
    ),
  ).aps
  check('live activity: event is start', body.event === 'start')
  check('live activity: attributes-type is the Swift struct', body['attributes-type'] === 'DeadlineActivityAttributes')
  check('live activity: attributes carry id, colour, path', body.attributes.assessmentId === 'a1' && body.attributes.colorHex === '#3b82f6' && body.attributes.path.startsWith('/app/'))
  check('live activity: content-state keys match ContentState', ['title', 'course', 'dueEpoch', 'outcome'].every((k) => k in body['content-state']))
  check('live activity: due is plain epoch seconds', body['content-state'].dueEpoch === 1790000000.5)
  check('live activity: alert present (required to start)', body.alert.title === 'T' && body.alert.body === 'B')
  check('live activity: stale at the deadline', body['stale-date'] === 1790000000)
  const lh = liveActivityHeaders('jwt', 'com.concordiatracker.app', 'tok')
  check('live activity: push type', lh['apns-push-type'] === 'liveactivity')
  check('live activity: topic suffix', lh['apns-topic'] === 'com.concordiatracker.app.push-type.liveactivity')
}

console.log(failures ? `\n${failures} failed\n` : '\nall passed\n')
process.exit(failures ? 1 : 0)
