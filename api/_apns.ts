/**
 * Apple Push Notification service: the parts that can be checked without a
 * network. Pure, and imports nothing but Node's crypto, so the test can load
 * it directly (`node api/_apns.test.mjs`).
 *
 * Token-based auth, not certificates: one .p8 key signs a short JWT, the JWT
 * rides on every request, and nothing expires on a calendar. The key and its
 * ids come from the environment (APNS_KEY_P8, APNS_KEY_ID, APNS_TEAM_ID) and
 * are never written into this repository.
 */
import { createPrivateKey, sign } from 'node:crypto'

const b64url = (buf: Buffer | string) =>
  Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

/**
 * A .p8 key as it tends to arrive through an environment variable: sometimes
 * with real newlines, sometimes with literal "\n", sometimes as the bare base64
 * body with no PEM frame. All three become the same PEM.
 */
export function normalisePem(raw: string): string {
  const text = raw.replace(/\\n/g, '\n').trim()
  if (text.includes('BEGIN PRIVATE KEY')) return text + '\n'
  const body = text.replace(/\s+/g, '')
  const lines = body.match(/.{1,64}/g) ?? []
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`
}

/**
 * The provider token APNs expects: ES256, header { alg, kid }, claims
 * { iss: team id, iat }. APNs refuses a token older than an hour and
 * rate-limits one refreshed more often than every 20 minutes, so callers cache
 * it (see `apnsToken` below) rather than signing per request.
 *
 * `dsaEncoding: 'ieee-p1363'` is the part that is easy to get wrong: Node signs
 * ECDSA as DER by default, and a JWT needs the raw 64-byte r||s.
 */
export function apnsJwt(pem: string, keyId: string, teamId: string, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const claims = b64url(JSON.stringify({ iss: teamId, iat: nowSec }))
  const input = `${header}.${claims}`
  const key = createPrivateKey(normalisePem(pem))
  const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
  return `${input}.${b64url(sig)}`
}

let cached: { token: string; at: number; keyId: string } | null = null

/** A provider token reused for 50 minutes (inside Apple's hour, outside its
 *  20-minute refresh floor). Per warm function instance, which is all that
 *  is needed: a cold start signing one more is harmless. */
export function apnsToken(pem: string, keyId: string, teamId: string, nowSec: number): string {
  if (cached && cached.keyId === keyId && nowSec - cached.at < 50 * 60) return cached.token
  const token = apnsJwt(pem, keyId, teamId, nowSec)
  cached = { token, at: nowSec, keyId }
  return token
}

export interface PushMessage {
  title: string
  body?: string
  /** In-app path the tap opens, e.g. /app/courses. */
  url?: string
  /** Collapses repeats of the same thing into one notification. */
  tag?: string
}

/**
 * The JSON body APNs delivers to the phone. `url` rides outside `aps` so the
 * app's tap handler can read it; `thread-id` groups related notifications in
 * Notification Centre the way the web `tag` groups them on a desktop.
 */
export function apnsBody(msg: PushMessage): string {
  return JSON.stringify({
    aps: {
      alert: msg.body ? { title: msg.title, body: msg.body } : { title: msg.title },
      sound: 'default',
      ...(msg.tag ? { 'thread-id': msg.tag.slice(0, 64) } : {}),
    },
    ...(msg.url ? { url: msg.url } : {}),
  })
}

/** Headers for one APNs request. The collapse id is capped at Apple's 64 bytes. */
export function apnsHeaders(token: string, bundleId: string, deviceToken: string, msg: PushMessage) {
  return {
    ':method': 'POST',
    ':path': `/3/device/${deviceToken}`,
    authorization: `bearer ${token}`,
    'apns-topic': bundleId,
    'apns-push-type': 'alert',
    'apns-priority': '10',
    ...(msg.tag ? { 'apns-collapse-id': Buffer.from(msg.tag).subarray(0, 64).toString() } : {}),
  }
}

export type ApnsOutcome = 'ok' | 'gone' | 'wrong-env' | 'error'

/**
 * What an APNs answer means for the stored token.
 *
 * 410 (Unregistered) and BadDeviceToken both come back for a token that will
 * never work again — but BadDeviceToken also comes back when a SANDBOX token
 * (an Xcode debug build) is sent to PRODUCTION, or the reverse. So that one is
 * "try the other environment" rather than "delete", and only a second failure
 * there makes it gone.
 */
export function classifyApns(status: number, reason: string | undefined): ApnsOutcome {
  if (status === 200) return 'ok'
  if (status === 410 || reason === 'Unregistered' || reason === 'ExpiredToken') return 'gone'
  if (reason === 'BadDeviceToken') return 'wrong-env'
  // DeviceTokenNotForTopic is a bundle-id mismatch (a token from another build
  // of the app): not ours to delete, and not fixed by switching environments.
  return 'error'
}

export const APNS_HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const
export type ApnsEnv = keyof typeof APNS_HOSTS

/**
 * A push-to-start for the "next assignment due" Live Activity (iOS 17.2+).
 *
 * The phone registers a push-to-start token (a different token from its
 * ordinary device token); this starts the activity with the app closed.
 * THE SHAPE MUST DECODE into ios/App/Shared/DeadlineActivityAttributes.swift:
 * `attributes` into the struct's stored properties and `content-state` into
 * its ContentState. The due time is `dueEpoch`, plain Unix seconds, precisely
 * so no Date coding strategy has to be agreed between here and Swift.
 */
export interface LiveActivityStart {
  assessmentId: string
  title: string
  course: string
  colorHex: string
  path: string
  dueEpoch: number
  alertTitle: string
  alertBody: string
}

export function liveActivityStartBody(s: LiveActivityStart, nowSec: number): string {
  return JSON.stringify({
    aps: {
      timestamp: nowSec,
      event: 'start',
      'attributes-type': 'DeadlineActivityAttributes',
      attributes: { assessmentId: s.assessmentId, colorHex: s.colorHex, path: s.path },
      'content-state': { title: s.title, course: s.course, dueEpoch: s.dueEpoch, outcome: 'pending' },
      // Stale at the deadline: the card then reads "Overdue" by itself.
      'stale-date': Math.floor(s.dueEpoch),
      'relevance-score': 80,
      // Required for push-to-start; this is also what shows on arrival.
      alert: { title: s.alertTitle, body: s.alertBody },
    },
  })
}

export function liveActivityHeaders(token: string, bundleId: string, pushToStartToken: string) {
  return {
    ':method': 'POST',
    ':path': `/3/device/${pushToStartToken}`,
    authorization: `bearer ${token}`,
    'apns-topic': `${bundleId}.push-type.liveactivity`,
    'apns-push-type': 'liveactivity',
    'apns-priority': '10',
  }
}
