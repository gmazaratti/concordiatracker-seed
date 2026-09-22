/**
 * Acting as a real account from a serverless function.
 *
 * WHY. Every organisation rule and every admin_* function in this database is
 * written against auth.uid(). The rest of /api/v1 talks to PostgREST as the
 * SERVICE ROLE, where auth.uid() is null and all of them refuse. Re-checking
 * those rules in TypeScript would be a second authorisation system, and the
 * two would drift the first time one of them changed.
 *
 * So the admin scope acts as a real user instead: we sign a token for that
 * account and PostgREST applies the same policies it applies to a browser.
 * Nothing new is permitted, and nothing has to be kept in step.
 *
 * WHY WE SIGN IT RATHER THAN SIGN IN. A password would be a much broader
 * credential: it works on the website, it mints a refresh token that outlives
 * the request, and somebody has to hold it. A token signed here lives for
 * sixty seconds, never leaves the function, and cannot be replayed usefully.
 * Signing needs SUPABASE_JWT_SECRET, which is strictly less powerful than the
 * service-role key already in this environment.
 *
 * AND A FALLBACK, SO NOTHING IS BLOCKED ON THAT SECRET. Without it, the
 * service-role key alone can still get a genuine session for the account:
 * generate a magic link (never sent anywhere) and redeem it. Measured at
 * ~165ms. The refresh token it issues is revoked immediately, and the access
 * token keeps verifying afterwards because it is a stateless JWT — checked,
 * not assumed. So no credential outlives the request either way; the signed
 * path is simply faster and does not touch the auth service.
 *
 * THE ct_agent CLAIM IS THE POINT. Four write policies and ct_can_act_as_org
 * grant an admin write access to every organisation. That is right for a human
 * in the console and wrong for an unattended agent, so the claim rides in the
 * token and db/alfred_admin_scope.sql turns those bypasses into "admin AND not
 * an agent". The narrowing is enforced by RLS, so a mistake in a handler here
 * cannot publish to an org the account does not belong to.
 *
 * This project signs HS256 with the legacy project secret, which was checked
 * rather than assumed: its anon key is {"alg":"HS256","iss":"supabase"}.
 */
import { createHmac } from 'node:crypto'

const b64 = (b: Buffer): string =>
  b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Sixty seconds. Long enough for one request, short enough that a copy taken
 *  out of a log is worthless by the time anybody reads it. */
const TTL_SECONDS = 60

export interface ActorToken {
  jwt: string
  userId: string
}

/** Only thrown when NEITHER route is available, which means the deployment
 *  has no Supabase configuration at all. */
export class JwtUnavailable extends Error {}

/**
 * Sign a Supabase access token for one account.
 *
 * `role: 'authenticated'` is what PostgREST switches on; `sub` is what
 * auth.uid() returns. `email` is included because two org helpers match a
 * membership row by email as well as by id.
 */
export function mintActorJwt(userId: string, email: string | null): string | null {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) return null
  const now = Math.floor(Date.now() / 1000)
  const header = b64(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = b64(
    Buffer.from(
      JSON.stringify({
        sub: userId,
        role: 'authenticated',
        aud: 'authenticated',
        email: email ?? undefined,
        iat: now,
        // A second of leeway: a function cold-starting on a host whose clock
        // is a hair behind Supabase's would otherwise mint a token from the
        // future and be refused.
        nbf: now - 1,
        exp: now + TTL_SECONDS,
        // Read by ct_is_agent(). Removes the admin write bypass; grants nothing.
        ct_agent: true,
      }),
    ),
  )
  const signature = b64(createHmac('sha256', secret).update(`${header}.${payload}`).digest())
  return `${header}.${payload}.${signature}`
}

/**
 * A session for the account, using only the service-role key.
 *
 * generate_link does NOT send anything — it hands back the token that would
 * have been in the email. Redeeming it gives an ordinary hour-long session,
 * which is longer than this needs, so the refresh token is thrown away at
 * once and only the access token is used, for this one request.
 *
 * THE CLAIM CANNOT RIDE IN THIS ONE. A real Supabase token carries no custom
 * claims, so `ct_agent` is absent and the narrowing would fail OPEN if the
 * claim were the only evidence. It is not: db/alfred_admin_scope.sql also
 * marks the account in `agent_accounts`, and ct_is_agent() reads either. That
 * table is the reason this fallback is safe to have at all.
 */
async function borrowSession(email: string): Promise<string | null> {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !svc || !anon) return null

  const gen = await fetch(`${url}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!gen.ok) return null
  const link = (await gen.json().catch(() => null)) as { hashed_token?: string } | null
  if (!link?.hashed_token) return null

  const ver = await fetch(`${url}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: anon, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash: link.hashed_token }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!ver.ok) return null
  const sess = (await ver.json().catch(() => null)) as
    | { access_token?: string; refresh_token?: string }
    | null
  if (!sess?.access_token) return null

  // Revoke the long-lived half straight away. Deliberately not awaited on the
  // critical path's behalf beyond this: if it fails the token still expires on
  // its own, and failing the request over it would be the worse outcome.
  void fetch(`${url}/auth/v1/logout?scope=global`, {
    method: 'POST',
    headers: { apikey: anon, Authorization: `Bearer ${sess.access_token}` },
  }).catch(() => {})

  return sess.access_token
}

/**
 * The token every admin-scope request runs as, by whichever route is open.
 *
 * Signing is preferred: it is instant, scoped to sixty seconds, and never
 * involves the auth service. The session route exists so a deployment that
 * has not been given the JWT secret still works rather than returning 503.
 */
export async function actorToken(userId: string, email: string | null): Promise<string> {
  const signed = mintActorJwt(userId, email)
  if (signed) return signed
  if (email) {
    const borrowed = await borrowSession(email)
    if (borrowed) return borrowed
  }
  throw new JwtUnavailable(
    email
      ? 'Could not obtain a token for the agent account. Set SUPABASE_JWT_SECRET, or check that the account still exists.'
      : 'The agent account has no email on its profile, so the API cannot act for it.',
  )
}

function base(): { url: string; anon: string } | null {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  return url && anon ? { url, anon } : null
}

export interface UserResult<T> {
  ok: boolean
  status: number
  data: T | null
  error: { code?: string; message?: string } | null
}

/**
 * Call PostgREST as the account, not as the service role.
 *
 * The apikey header stays the ANON key on purpose. Sending the service-role
 * key alongside a user JWT is the mistake that quietly reinstates every bypass
 * this file exists to remove.
 */
export async function asUser<T>(
  jwt: string,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<UserResult<T>> {
  const b = base()
  if (!b) {
    return { ok: false, status: 500, data: null, error: { message: 'The API is not configured on this server.' } }
  }
  const headers: Record<string, string> = {
    apikey: b.anon,
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  }
  if (init.prefer) headers.Prefer = init.prefer
  const res = await fetch(`${b.url}/rest/v1/${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
  })
  const text = await res.text()
  const parsed = text ? ((): unknown => { try { return JSON.parse(text) } catch { return text } })() : null
  if (!res.ok) {
    const e = (parsed ?? {}) as { code?: string; message?: string }
    return { ok: false, status: res.status, data: null, error: { code: e.code, message: e.message ?? text } }
  }
  return { ok: true, status: res.status, data: (parsed as T) ?? null, error: null }
}

/** An RPC as the account. */
export const rpcAsUser = <T>(jwt: string, name: string, body: Record<string, unknown>) =>
  asUser<T>(jwt, `rpc/${name}`, { method: 'POST', body })

/**
 * Upload bytes to the public org-media bucket as the account.
 *
 * The path stays inside the account's own {uid}/ folder, which is exactly what
 * the bucket's insert policy allows a browser, so one storage rule covers both
 * the app and this API and neither needs an exception.
 */
export async function uploadAsUser(
  jwt: string,
  userId: string,
  filename: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ url: string } | { error: string }> {
  const b = base()
  if (!b) return { error: 'The API is not configured on this server.' }
  const key = `${userId}/${Date.now()}-${filename}`
  const res = await fetch(`${b.url}/storage/v1/object/org-media/${encodeURI(key)}`, {
    method: 'POST',
    headers: {
      apikey: b.anon,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: new Uint8Array(bytes),
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    return { error: body || `Upload failed with ${res.status}.` }
  }
  return { url: `${b.url}/storage/v1/object/public/org-media/${encodeURI(key)}` }
}
