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
  liveActivityHeaders,
  liveActivityStartBody,
  type ApnsEnv,
  type LiveActivityStart,
  type PushMessage,
} from './_apns.js'

export type { PushMessage } from './_apns.js'

/** The columns every sender selects. */
export const SUB_COLS = 'id,user_id,endpoint,kind,p256dh,auth,device_token,apns_env'

export interface PushTarget {
  id?: string
  user_id?: string
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

function apnsRequest(
  env: ApnsEnv,
  cfg: ApnsConfig,
  deviceToken: string,
  msg: PushMessage,
  /** A non-alert request (a Live Activity start): its own headers and body. */
  custom?: { headers: (jwt: string) => Record<string, string>; body: string },
) {
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
      const req = session(env).request(custom ? custom.headers(token) : apnsHeaders(token, cfg.bundleId, deviceToken, msg))
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
      req.end(custom ? custom.body : apnsBody(msg))
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

/**
 * Start the "next assignment due" Live Activity on one phone with the app
 * closed, through its push-to-start token. Same host fallback as alerts: a
 * TestFlight build is production, an Xcode build is sandbox. Never throws.
 */
export async function sendLiveActivityStart(
  pushToStartToken: string,
  env: ApnsEnv | null,
  start: LiveActivityStart,
): Promise<PushResult> {
  const cfg = apnsConfig()
  if (!cfg) return { status: 'skipped' }
  const first: ApnsEnv = env ?? 'production'
  const second: ApnsEnv = first === 'production' ? 'sandbox' : 'production'
  const body = liveActivityStartBody(start, Math.floor(Date.now() / 1000))
  for (const e of [first, second]) {
    const r = await apnsRequest(e, cfg, pushToStartToken, { title: '' }, {
      headers: (jwt) => liveActivityHeaders(jwt, cfg.bundleId, pushToStartToken),
      body,
    })
    const outcome = classifyApns(r.status, r.reason)
    if (outcome === 'ok') return e === env ? { status: 'ok' } : { status: 'ok', env: e }
    if (outcome === 'gone') return { status: 'gone' }
    if (outcome === 'error') return { status: 'error' }
  }
  return { status: 'gone' }
}

/**
 * What a push was for, read off its tag (every sender sets one). Stored on
 * push_log so the admin Push page can compare open rates by kind.
 */
export function pushKind(tag: string | undefined): string {
  const t = tag ?? ''
  if (t.startsWith('ct-admin-activity')) return 'admin_alert'
  if (t.startsWith('ct-admin-')) return 'admin'
  if (t.startsWith('ct-reminder-')) return 'reminder'
  if (t.startsWith('ct-due-')) return 'assignment'
  if (t.startsWith('ct-trial-')) return 'trial'
  if (t.startsWith('ct-seat-')) return 'seat'
  if (t.startsWith('ct-bell-')) return 'bell'
  if (/^ct-(signup|org|ticket|scanfail|scan|reply|fb)-/.test(t)) return 'admin_alert'
  if (t === 'ct-test') return 'test'
  return 'other'
}

/** Add ?pn=<log id> to an in-app path so opening it can be counted. */
export function withPushId(url: string | undefined, id: string): string {
  const u = url && url.startsWith('/') ? url : '/app'
  const [path, hash = ''] = u.split('#')
  return `${path}${path.includes('?') ? '&' : '?'}pn=${id}${hash ? `#${hash}` : ''}`
}

/**
 * Write one push_log row before sending (so the link can carry its id), and
 * fill in how many devices took it afterwards. Never throws: a push that could
 * not be logged still goes out, just without tracking.
 */
export async function logPush(
  supabaseUrl: string,
  serviceKey: string,
  row: { user_id: string; kind: string; title: string; body?: string | null; url?: string | null; devices: number; sent_by?: string | null },
): Promise<string | null> {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/push_log`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ ...row, title: row.title.slice(0, 200), body: row.body ?? null, url: row.url ?? null, sent_by: row.sent_by ?? null }),
    })
    if (!r.ok) return null
    const rows = (await r.json()) as { id: string }[]
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}

export async function setPushDelivered(supabaseUrl: string, serviceKey: string, id: string, delivered: number): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/push_log?id=eq.${id}`, {
    method: 'PATCH',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivered }),
  }).catch(() => {})
}
