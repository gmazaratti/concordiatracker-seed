/**
 * One way to push to one device, whatever the device is.
 *
 * `push_subscriptions` holds two kinds of row (db/native_push.sql):
 *   web  — a browser's Web Push subscription (endpoint + p256dh + auth), sent
 *          with VAPID through `web-push`, exactly as before.
 *   apns — an iPhone running the App Store app (a device token), sent straight
 *          to Apple over HTTP/2 with a token-signed request.
 *
 * Every sender (reminders, seat alerts, the bell, the admin digest, the test
 * button) goes through `sendPush`, so a new kind of notification cannot
 * accidentally reach only half of someone's devices.
 *
 * APNs configuration is optional: with no APNS_* variables the web half works
 * unchanged and apns rows are skipped (counted, not failed).
 */
import http2 from 'node:http2'
import webpush from 'web-push'
import {
  APNS_HOSTS,
  apnsBody,
  apnsHeaders,
  apnsToken,
  classifyApns,
  type ApnsEnv,
  type PushMessage,
} from './_apns.js'

export type { PushMessage } from './_apns.js'

/** The columns every sender selects. */
export const SUB_COLS = 'id,endpoint,kind,p256dh,auth,device_token,apns_env'

export interface PushTarget {
  id?: string
  endpoint: string
  kind?: 'web' | 'apns' | null
  p256dh?: string | null
  auth?: string | null
  device_token?: string | null
  apns_env?: ApnsEnv | null
}

/** 'gone' = the device will never accept a push again; the caller deletes it.
 *  'env' carries the APNs environment that worked, when it was not the one
 *  stored, so the caller can remember it. */
export type PushResult =
  | { status: 'ok'; env?: ApnsEnv }
  | { status: 'gone' }
  | { status: 'skipped' }
  | { status: 'error' }

interface ApnsConfig {
  pem: string
  keyId: string
  teamId: string
  bundleId: string
}

function apnsConfig(): ApnsConfig | null {
  const pem = process.env.APNS_KEY_P8
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  if (!pem || !keyId || !teamId) return null
  return { pem, keyId, teamId, bundleId: process.env.APNS_BUNDLE_ID || 'com.concordiatracker.app' }
}

let vapidReady = false
function ensureVapid(): boolean {
  if (vapidReady) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:concordiatracker@gmail.com', publicKey, privateKey)
  vapidReady = true
  return true
}

/* One HTTP/2 session per APNs host for the life of an invocation: opening a
 * TLS connection per notification is what Apple's docs ask you not to do. */
const sessions = new Map<ApnsEnv, http2.ClientHttp2Session>()
function session(env: ApnsEnv): http2.ClientHttp2Session {
  const open = sessions.get(env)
  if (open && !open.closed && !open.destroyed) return open
  const s = http2.connect(APNS_HOSTS[env])
  s.on('error', () => sessions.delete(env))
  sessions.set(env, s)
  return s
}

/** Close the APNs connections. Call once at the end of a sender, or the
 *  function stays alive holding an idle socket until the platform kills it. */
export function closePush(): void {
  for (const s of sessions.values()) s.close()
  sessions.clear()
}

function apnsRequest(env: ApnsEnv, cfg: ApnsConfig, deviceToken: string, msg: PushMessage) {
  return new Promise<{ status: number; reason?: string }>((resolve) => {
    let settled = false
    const done = (v: { status: number; reason?: string }) => {
      if (!settled) {
        settled = true
        resolve(v)
      }
    }
    try {
      const token = apnsToken(cfg.pem, cfg.keyId, cfg.teamId, Math.floor(Date.now() / 1000))
      const req = session(env).request(apnsHeaders(token, cfg.bundleId, deviceToken, msg))
      req.setTimeout(10_000, () => {
        req.close()
        done({ status: 0, reason: 'timeout' })
      })
      let status = 0
      let raw = ''
      req.on('response', (h) => {
        status = Number(h[':status'] ?? 0)
      })
      req.setEncoding('utf8')
      req.on('data', (chunk: string) => (raw += chunk))
      req.on('end', () => {
        let reason: string | undefined
        try {
          reason = raw ? (JSON.parse(raw) as { reason?: string }).reason : undefined
        } catch {
          reason = undefined
        }
        done({ status, reason })
      })
      req.on('error', () => done({ status: 0, reason: 'network' }))
      req.end(apnsBody(msg))
    } catch {
      done({ status: 0, reason: 'setup' })
    }
  })
}

/** Push one message to one stored device. Never throws. */
export async function sendPush(target: PushTarget, msg: PushMessage): Promise<PushResult> {
  if (target.kind === 'apns') {
    const cfg = apnsConfig()
    const deviceToken = target.device_token
    if (!cfg || !deviceToken) return { status: 'skipped' }
    // TestFlight and App Store builds use production; an Xcode debug build is
    // sandbox. Start with what worked last time, fall back to the other once.
    const first: ApnsEnv = target.apns_env ?? 'production'
    const second: ApnsEnv = first === 'production' ? 'sandbox' : 'production'
    for (const env of [first, second]) {
      const r = await apnsRequest(env, cfg, deviceToken, msg)
      const outcome = classifyApns(r.status, r.reason)
      if (outcome === 'ok') return env === target.apns_env ? { status: 'ok' } : { status: 'ok', env }
      if (outcome === 'gone') return { status: 'gone' }
      if (outcome === 'error') return { status: 'error' }
      // wrong-env: try the other host
    }
    return { status: 'gone' }
  }

  if (!target.p256dh || !target.auth) return { status: 'skipped' }
  if (!ensureVapid()) return { status: 'skipped' }
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(msg),
    )
    return { status: 'ok' }
  } catch (err: unknown) {
    const code = (err as { statusCode?: number })?.statusCode
    return code === 404 || code === 410 ? { status: 'gone' } : { status: 'error' }
  }
}
