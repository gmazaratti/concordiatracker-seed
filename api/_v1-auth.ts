/**
 * Turning a Bearer token into an identity, for /api/v1.
 *
 * WHY NOT JUST ACCEPT A SUPABASE JWT. One expires in an hour and is minted by
 * a browser sign-in, so nothing unattended can use it. These tokens are named,
 * long-lived, revocable one at a time, and carry a scope narrower than a
 * session — a leaked 'me' token cannot read anybody else's data, and a leaked
 * 'owner' token cannot read any individual's data at all.
 *
 * THE SERVER NEVER STORES WHAT IT RECEIVES. We hash the presented token and
 * look the hash up; `api_tokens` holds nothing that could be replayed.
 */
import { createHash } from 'node:crypto'

export type Scope = 'owner' | 'me' | 'support' | 'admin'

export interface Caller {
  userId: string
  scope: Scope
  tokenId: string
}

export interface AuthFailure {
  status: 401 | 429 | 500 | 503
  message: string
  retryAfter?: number
}

/** The service-role Supabase client's raw bits. Every v1 read uses these. */
export function svc() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? { url, key } : null
}

/** POST an RPC as the service role and return parsed JSON, or null. */
export async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T | null> {
  const s = svc()
  if (!s) return null
  const res = await fetch(`${s.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: s.key,
      Authorization: `Bearer ${s.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return null
  return (await res.json().catch(() => null)) as T | null
}

/**
 * The same call, but handing back the error body instead of null.
 *
 * `rpc` swallowing the reason is right for a statistic — a missing number is
 * a missing number. It is wrong wherever the DATABASE is the thing enforcing
 * a rule, because then the refusal IS the answer and the caller has to be
 * able to tell "you may not" from "it broke".
 */
export async function rpcRaw(
  name: string,
  body: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: unknown }> {
  const s = svc()
  if (!s) return { ok: false, error: { message: 'The API is not configured on this server.' } }
  const res = await fetch(`${s.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: s.key,
      Authorization: `Bearer ${s.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const parsed = await res.json().catch(() => null)
  return res.ok ? { ok: true, data: parsed } : { ok: false, error: parsed ?? {} }
}

/** GET a PostgREST table as the service role. */
export async function table<T>(path: string): Promise<T[]> {
  const s = svc()
  if (!s) return []
  const res = await fetch(`${s.url}/rest/v1/${path}`, {
    headers: { apikey: s.key, Authorization: `Bearer ${s.key}` },
  })
  if (!res.ok) return []
  return ((await res.json().catch(() => [])) as T[]) ?? []
}

interface CheckRow {
  user_id: string
  scope: Scope
  token_id: string
  allowed: boolean
  retry_after: number
}

/**
 * Verify the Authorization header.
 *
 * Returns the caller, or a failure that already knows its own status code —
 * an unknown token and a throttled one are different answers and the endpoint
 * must not blur them: 401 means "this will never work", 429 means "try again
 * in a moment", and a client that cannot tell them apart retries forever or
 * gives up wrongly.
 */
export async function authenticate(req: {
  headers?: Record<string, string | string[] | undefined>
}): Promise<{ caller: Caller } | { error: AuthFailure }> {
  if (!svc()) {
    return { error: { status: 500, message: 'The API is not configured on this server.' } }
  }

  const raw = req.headers?.authorization
  const header = Array.isArray(raw) ? raw[0] : (raw ?? '')
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) {
    return { error: { status: 401, message: 'Send `Authorization: Bearer <token>`.' } }
  }

  // Hashed here rather than sent to the database as plaintext, so the token
  // never appears in a query log.
  const hash = createHash('sha256').update(token, 'utf8').digest('hex')

  /*
   * A LOOKUP THAT FAILED IS NOT A TOKEN THAT IS WRONG.
   *
   * This used to call `rpc`, which answers null for a refusal and for a
   * timeout and for a 500 alike — so any wobble in the database came out of
   * here as "That token is not valid." on every endpoint at once. That is the
   * worst possible lie for this particular sentence: it sends someone to
   * re-mint a credential that was fine, and it looks exactly like a
   * revocation they did not perform. 503 says "ask again", 401 says "never".
   *
   * Same distinction `rpcRaw` exists for, and the same one the ticket list
   * and the admin queue both needed: loading, failing and empty are three
   * states, not two.
   */
  let rows: CheckRow[] | null = null
  try {
    const r = await rpcRaw('ct_api_token_check', { p_hash: hash, p_limit: 120 })
    if (!r.ok) {
      return {
        error: {
          status: 503,
          message: 'Could not verify the token right now: the database did not answer. The token itself is probably fine; try again in a moment.',
          retryAfter: 2,
        },
      }
    }
    rows = (r.data ?? []) as CheckRow[]
  } catch {
    return {
      error: {
        status: 503,
        message: 'Could not reach the database to verify the token. Try again in a moment.',
        retryAfter: 5,
      },
    }
  }
  const row = rows[0]

  if (!row) {
    // Deliberately the same sentence for "never existed" and "revoked": which
    // one it is tells a stranger holding a stolen token something useful.
    return { error: { status: 401, message: 'That token is not valid.' } }
  }
  if (!row.allowed) {
    return {
      error: {
        status: 429,
        message: 'Too many requests for this token. The limit is 120 a minute.',
        retryAfter: row.retry_after,
      },
    }
  }
  return { caller: { userId: row.user_id, scope: row.scope, tokenId: row.token_id } }
}

/** ISO-8601 in UTC, always — the format every endpoint here promises. */
export const iso = (d: Date | string | number): string => new Date(d).toISOString()

/** Midnight UTC, n days back. */
export function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}
