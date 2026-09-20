/**
 * /api/v1/* — the public API, behind a token.
 *
 * ONE FUNCTION FOR EVERY v1 PATH. Vercel's Hobby plan allows twelve
 * serverless functions and this project lives at the ceiling, so `vercel.json`
 * rewrites `/api/v1/:path*` into `?path=` here rather than giving each
 * endpoint its own file. The public URLs are the ordinary ones a reader would
 * guess — `/api/v1/owner/overview`, `/api/v1/me/courses` — and nothing about
 * the hosting arrangement leaks into them.
 *
 * WHY AN EXPLICIT REWRITE and not a `[...path].ts` catch-all: `vercel.json`
 * already sends every unmatched `/api/*` to the 404, and relying on the
 * filesystem being consulted first is the kind of assumption that has broken
 * this project's routing twice. A named rewrite is checkable, and
 * scripts/verify-routing.mjs checks it.
 *
 * THE SCOPE GATE IS HERE AND NOWHERE ELSE. Every handler below is reached
 * only after `authenticate` and only through the branch matching its scope, so
 * a `me` token cannot fall through to an owner handler no matter what path it
 * asks for.
 */
import { authenticate } from './_v1-auth.js'
import { ownerOverview, ownerPayments, ownerPing, ownerTimeseries, ownerUsers } from './_v1-owner.js'
import { meAssignments, meCourses, meGpa, patchAssignment } from './_v1-me.js'
import { fail } from './_respond.js'

export const config = { maxDuration: 30 }

const INDEX = {
  service: 'ConcordiaTracker API v1',
  docs: 'https://concordiatracker.com/docs/api',
  spec: 'https://concordiatracker.com/openapi.json',
  auth: 'Authorization: Bearer <token>. Create one in Settings (personal) or the admin console (owner).',
  scopes: {
    owner: ['GET /api/v1/owner/overview', 'GET /api/v1/owner/users', 'GET /api/v1/owner/payments', 'GET /api/v1/owner/timeseries?days=30', 'GET /api/v1/owner/ping'],
    me: ['GET /api/v1/me/courses', 'GET /api/v1/me/assignments', 'PATCH /api/v1/me/assignments/{id}', 'GET /api/v1/me/gpa'],
  },
  rate_limit: '120 requests per minute per token.',
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function readBody(req: any): Record<string, unknown> {
  const b = req?.body
  if (!b) return {}
  if (typeof b === 'string') {
    try {
      return JSON.parse(b) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return typeof b === 'object' ? (b as Record<string, unknown>) : {}
}

export default async function handler(req: any, res: any) {
  // Read-only from a browser is fine and useful (a dashboard on another
  // origin); the token is the credential, so CORS is not the control here.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const raw = String(req.query?.path ?? '')
    .split('/')
    .filter(Boolean)

  if (!raw.length) {
    res.status(200).json(INDEX)
    return
  }

  const auth = await authenticate(req)
  if ('error' in auth) {
    if (auth.error.retryAfter) res.setHeader('Retry-After', String(auth.error.retryAfter))
    // The shared default hint names a Supabase access token, which is the one
    // credential that will NOT work here — so this route says what it wants.
    fail(res, auth.error.status, auth.error.message, {
      hint:
        auth.error.status === 429
          ? 'Each token is limited to 120 requests a minute. Wait for the Retry-After header and try again.'
          : 'Send an API token as "Authorization: Bearer ct_owner_..." or "ct_pat_...". Create one in Settings → Developer, or in the admin console for an owner token. A Supabase session token will not work here.',
    })
    return
  }
  const { caller } = auth

  const [area, resource, id] = raw
  try {
    if (area === 'owner') {
      if (caller.scope !== 'owner') {
        fail(res, 403, 'This token is scoped to your own data, not to business statistics.')
        return
      }
      if (req.method !== 'GET') {
        fail(res, 405, 'The owner endpoints are read-only.')
        return
      }
      // Short and PRIVATE: these figures are per-token and must never be held
      // by a shared cache, but a dashboard polling every few seconds should
      // not hit the database each time either.
      res.setHeader('Cache-Control', 'private, max-age=30')

      if (resource === 'overview') return void res.status(200).json(await ownerOverview())
      if (resource === 'users') return void res.status(200).json(await ownerUsers())
      if (resource === 'payments') return void res.status(200).json(await ownerPayments())
      if (resource === 'timeseries')
        return void res.status(200).json(await ownerTimeseries(req.query?.days))
      if (resource === 'ping') return void res.status(200).json(await ownerPing())
      fail(res, 404, `No owner endpoint called "${resource ?? ''}".`)
      return
    }

    if (area === 'me') {
      if (caller.scope !== 'me') {
        fail(res, 403, 'An owner token reads statistics, not an individual account.')
        return
      }
      res.setHeader('Cache-Control', 'private, no-store')

      if (req.method === 'PATCH' && resource === 'assignments') {
        const out = await patchAssignment(caller.userId, String(id ?? ''), readBody(req))
        if (out.status !== 200) {
          fail(res, out.status as 400 | 404, String(out.json.error ?? 'Could not update that.'))
          return
        }
        res.status(200).json(out.json)
        return
      }
      if (req.method !== 'GET') {
        fail(res, 405, 'Only GET, and PATCH on /me/assignments/{id}.')
        return
      }
      const q = (req.query ?? {}) as Record<string, unknown>
      if (resource === 'courses') return void res.status(200).json(await meCourses(caller.userId, q))
      if (resource === 'assignments')
        return void res.status(200).json(await meAssignments(caller.userId, q))
      if (resource === 'gpa') return void res.status(200).json(await meGpa(caller.userId))
      fail(res, 404, `No personal endpoint called "${resource ?? ''}".`)
      return
    }

    fail(res, 404, 'Unknown area. The API has two: /api/v1/owner and /api/v1/me.')
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Unexpected error.')
  }
}
