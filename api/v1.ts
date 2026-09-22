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
import {
  meAssignments,
  meCalendar,
  meCourses,
  meGpa,
  patchAssignment,
  setGrade,
} from './_v1-me.js'
import {
  addNote,
  courseFromOutline,
  createAssignment,
  createCourse,
  deleteAssignment,
  deleteCourse,
  getAssignment,
  getCourse,
  patchCourse,
} from './_v1-me-write.js'
import {
  getThread,
  kbList,
  kbOne,
  kbSearch,
  listThreads,
  patchThread,
  replyToThread,
} from './_v1-support.js'
import { adminCall, adminIndex } from './_v1-admin.js'
import {
  claimOrg,
  createOrg,
  getOrg,
  listOrgs,
  patchOrg,
  setOrgImage,
  uploadMedia,
} from './_v1-orgs.js'
import {
  createEvent,
  createInvite,
  createPost,
  createStory,
  getTeam,
  hidePost,
  listEvents,
  listInvites,
  listPosts,
  listStories,
  orgInsights,
  patchEvent,
  revokeInvite,
} from './_v1-org-publish.js'
import { JwtUnavailable, mintActorJwt } from './_v1-jwt.js'
import { table } from './_v1-auth.js'
import { fail } from './_respond.js'

export const config = { maxDuration: 30 }

const INDEX = {
  service: 'ConcordiaTracker API v1',
  docs: 'https://concordiatracker.com/docs/api',
  spec: 'https://concordiatracker.com/openapi.json',
  auth: 'Authorization: Bearer <token>. Create one in Settings (personal) or the admin console (owner).',
  scopes: {
    owner: ['GET /api/v1/owner/overview', 'GET /api/v1/owner/users', 'GET /api/v1/owner/payments', 'GET /api/v1/owner/timeseries?days=30', 'GET /api/v1/owner/ping'],
    me: [
      'GET|POST /api/v1/me/courses',
      'GET|PATCH|DELETE /api/v1/me/courses/{id}',
      'POST /api/v1/me/courses/from-outline  (PDF body)',
      'GET|POST /api/v1/me/assignments',
      'GET|PATCH|DELETE /api/v1/me/assignments/{id}',
      'POST /api/v1/me/assignments/{id}/notes  { "note": "…" }',
      'PATCH /api/v1/me/assignments/{id}/grade  { "percent" } or { "earned", "total" }',
      'GET /api/v1/me/gpa',
      'GET /api/v1/me/calendar?from=&to=',
    ],
    support: [
      'GET /api/v1/support/threads?type=&status=&needs_human=&since=&limit=&cursor=',
      'GET /api/v1/support/threads/{id}',
      'POST /api/v1/support/threads/{id}/replies  { "body": "…" }',
      'PATCH /api/v1/support/threads/{id}  { "status"?, "needs_human"? }',
      'GET /api/v1/support/kb',
      'GET /api/v1/support/kb/{id}',
      'GET /api/v1/support/kb/search?q=',
    ],
    admin: [
      'GET /api/v1/admin  (the list of everything below)',
      'GET /api/v1/admin/{name}  e.g. overview, users, tickets, orgs, audit',
      'POST /api/v1/admin/{name}  the non-destructive writes',
      'GET|POST /api/v1/orgs',
      'GET|PATCH /api/v1/orgs/{handle}',
      'POST /api/v1/orgs/{handle}/claim',
      'POST /api/v1/orgs/{handle}/logo | /banner | /media   (image bytes)',
      'GET|POST /api/v1/orgs/{handle}/events, PATCH /events/{id}',
      'GET|POST /api/v1/orgs/{handle}/posts, DELETE /posts/{id}',
      'GET|POST /api/v1/orgs/{handle}/stories',
      'GET|POST /api/v1/orgs/{handle}/invites, DELETE /invites/{id}',
      'GET /api/v1/orgs/{handle}/team, GET /api/v1/orgs/{handle}/insights',
    ],
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

/**
 * Send a handler's result.
 *
 * AN ERROR STILL CARRIES ITS REASON. The shared error shape is what every
 * other endpoint returns and is worth keeping, but a 409 from the support
 * desk is only useful if the caller can tell "a human took it" from "the
 * customer asked for one", and the generic code (conflict) cannot say which.
 * So the reason rides along as an extra field rather than being flattened
 * into the sentence, where it would have to be matched on.
 */
function send(res: any, out: { status: number; json: Record<string, unknown> }) {
  if (out.status < 400) {
    res.status(out.status).json(out.json)
    return
  }
  fail(res, out.status, String(out.json.error ?? 'Request failed.'), {
    extra: out.json.reason ? { reason: out.json.reason } : undefined,
  })
}

/** The request body as bytes. Vercel hands a Buffer when the content type
 *  is not JSON; a string means the platform decoded it and latin1 puts the
 *  bytes back unchanged. */
async function rawBody(req: any): Promise<ArrayBuffer> {
  const b = req?.body
  if (b instanceof ArrayBuffer) return b
  if (Buffer.isBuffer(b)) return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
  if (typeof b === 'string') {
    const buf = Buffer.from(b, 'latin1')
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
  }
  // Nothing pre-parsed: read the stream.
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))
  const all = Buffer.concat(chunks)
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.byteLength) as ArrayBuffer
}

const contentType = (req: any): string =>
  String(req?.headers?.['content-type'] ?? 'application/pdf').split(';')[0]

/** Where invite links should point. The deployment's own host, so a preview
 *  build hands out preview links rather than production ones. */
function siteOrigin(req: any): string {
  const host = String(req?.headers?.['x-forwarded-host'] ?? req?.headers?.host ?? '')
  if (!host) return 'https://concordiatracker.com'
  const proto = String(req?.headers?.['x-forwarded-proto'] ?? 'https')
  return proto + '://' + host
}

/** Two org helpers match a membership row by email as well as by id, so the
 *  minted token carries one. Missing is fine; it only narrows the match. */
async function actorEmail(userId: string): Promise<string | null> {
  const rows = await table<{ email: string | null }>(
    'user_profile?user_id=eq.' + encodeURIComponent(userId) + '&select=email&limit=1',
  )
  return rows[0]?.email ?? null
}

export default async function handler(req: any, res: any) {
  // Read-only from a browser is fine and useful (a dashboard on another
  // origin); the token is the credential, so CORS is not the control here.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
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
        // Name the scope the caller actually holds. "Scoped to your own data"
        // was written when there were two scopes and reads as nonsense to a
        // support key, which is scoped to other people's conversations.
        fail(
          res,
          403,
          `This is a ${caller.scope} token. Business statistics need an owner token.`,
        )
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
        fail(res, 403, 'This is a ' + caller.scope + ' token. Personal data needs a me token.')
        return
      }
      res.setHeader('Cache-Control', 'private, no-store')

      const q = (req.query ?? {}) as Record<string, unknown>
      const uid = caller.userId
      const sub = raw[3] // /me/{resource}/{id}/{sub}
      const M = req.method

      if (resource === 'courses') {
        // /me/courses/from-outline — checked BEFORE the {id} branch, because
        // "from-outline" would otherwise be read as a course id and 404.
        if (id === 'from-outline') {
          if (M !== 'POST') return void fail(res, 405, 'Uploading an outline is a POST.')
          return void send(res, await courseFromOutline(uid, await rawBody(req), contentType(req), q))
        }
        if (id) {
          if (M === 'GET') return void send(res, await getCourse(uid, decodeURIComponent(id)))
          if (M === 'PATCH')
            return void send(res, await patchCourse(uid, decodeURIComponent(id), readBody(req)))
          if (M === 'DELETE')
            return void send(
              res,
              await deleteCourse(uid, decodeURIComponent(id), String(q.hard ?? '') === 'true'),
            )
          return void fail(res, 405, 'GET, PATCH or DELETE on a course.')
        }
        if (M === 'GET') return void send(res, await meCourses(uid, q))
        if (M === 'POST') return void send(res, await createCourse(uid, readBody(req)))
        return void fail(res, 405, 'GET to list courses, POST to create one.')
      }

      if (resource === 'assignments') {
        if (id && sub === 'notes') {
          if (M !== 'POST') return void fail(res, 405, 'Adding a note is a POST.')
          return void send(res, await addNote(uid, decodeURIComponent(id), readBody(req)))
        }
        if (id && sub === 'grade') {
          if (M !== 'PATCH') return void fail(res, 405, 'Setting a grade is a PATCH.')
          return void send(res, await setGrade(uid, decodeURIComponent(id), readBody(req)))
        }
        if (id) {
          if (M === 'GET') return void send(res, await getAssignment(uid, decodeURIComponent(id)))
          if (M === 'PATCH')
            return void send(res, await patchAssignment(uid, decodeURIComponent(id), readBody(req)))
          if (M === 'DELETE') return void send(res, await deleteAssignment(uid, decodeURIComponent(id)))
          return void fail(res, 405, 'GET, PATCH or DELETE on an assignment.')
        }
        if (M === 'GET') return void send(res, await meAssignments(uid, q))
        if (M === 'POST') return void send(res, await createAssignment(uid, readBody(req)))
        return void fail(res, 405, 'GET to list assignments, POST to create one.')
      }

      if (M !== 'GET') return void fail(res, 405, 'That endpoint is read-only.')
      if (resource === 'gpa') return void send(res, await meGpa(uid))
      if (resource === 'calendar') return void send(res, await meCalendar(uid, q))
      fail(res, 404, `No personal endpoint called "${resource ?? ''}".`)
      return
    }

    if (area === 'support') {
      if (caller.scope !== 'support') {
        fail(res, 403, 'This is a ' + caller.scope + ' token. The support desk needs a support token.')
        return
      }
      // A conversation is never cached. The whole job is noticing that
      // something changed since the last poll.
      res.setHeader('Cache-Control', 'private, no-store')

      if (resource === 'kb') {
        if (req.method !== 'GET') {
          fail(res, 405, 'The knowledge base is read-only.')
          return
        }
        const q = (req.query ?? {}) as Record<string, unknown>
        // /kb/search comes before /kb/{id}: "search" is a reserved id, and a
        // future article slugged "search" would otherwise shadow the endpoint.
        if (id === 'search') return void send(res, kbSearch(q))
        if (id) return void send(res, kbOne(decodeURIComponent(id)))
        // ?q= on the bare path still works — it is what the first cut did.
        if (String(q.q ?? '').trim()) return void send(res, kbSearch(q))
        return void send(res, kbList())
      }

      if (resource !== 'threads') {
        fail(res, 404, `No support endpoint called "${resource ?? ''}".`)
        return
      }

      // /support/threads/{id}/replies — the id is one segment and the action
      // the next. A thread id contains a colon, never a slash, so the two
      // cannot run into each other. Singular is accepted as well: it is what
      // the first cut of this endpoint used.
      if (id && (raw[3] === 'replies' || raw[3] === 'reply')) {
        if (req.method !== 'POST') {
          fail(res, 405, 'Replying is a POST.')
          return
        }
        return void send(res, await replyToThread(decodeURIComponent(id), readBody(req)))
      }
      if (id) {
        if (req.method === 'PATCH') {
          return void send(res, await patchThread(decodeURIComponent(id), readBody(req)))
        }
        if (req.method !== 'GET') {
          fail(res, 405, 'Use GET to read a thread, or PATCH to change its state.')
          return
        }
        return void send(res, await getThread(decodeURIComponent(id)))
      }
      if (req.method !== 'GET') {
        fail(res, 405, 'Listing threads is a GET.')
        return
      }
      return void send(res, await listThreads((req.query ?? {}) as Record<string, unknown>))
    }

    if (area === 'admin' || area === 'orgs') {
      if (caller.scope !== 'admin') {
        fail(
          res,
          403,
          'This is a ' + caller.scope + ' token. Managing organisations and reading admin data needs an admin token.',
        )
        return
      }
      res.setHeader('Cache-Control', 'private, no-store')

      // Act as the account rather than as the service role, so the database's
      // own policies decide. The ct_agent claim inside this token is what
      // removes the admin write bypass, so publishing still needs membership.
      let jwt: string
      try {
        jwt = mintActorJwt(caller.userId, await actorEmail(caller.userId))
      } catch (e) {
        if (e instanceof JwtUnavailable) {
          fail(res, 503, e.message, {
            hint: 'Set SUPABASE_JWT_SECRET (Supabase Dashboard, Settings, API, JWT Settings) on the deployment.',
          })
          return
        }
        throw e
      }

      const q = (req.query ?? {}) as Record<string, unknown>
      const M = req.method as string
      const uid = caller.userId

      if (area === 'admin') {
        if (!resource) return void send(res, adminIndex())
        return void send(res, await adminCall(jwt, resource, M, q, readBody(req)))
      }

      // /orgs, /orgs/{handle}, /orgs/{handle}/{section}/{itemId}
      const handle = resource
      const section = raw[2]
      const itemId = raw[3]
      const origin = siteOrigin(req)

      if (!handle) {
        if (M === 'GET') return void send(res, await listOrgs(jwt, q))
        if (M === 'POST') return void send(res, await createOrg(jwt, readBody(req)))
        return void fail(res, 405, 'GET to list organisations, POST to create one.')
      }

      if (!section) {
        if (M === 'GET') return void send(res, await getOrg(jwt, handle))
        if (M === 'PATCH') return void send(res, await patchOrg(jwt, uid, handle, readBody(req)))
        return void fail(res, 405, 'GET to read an organisation, PATCH to edit it.')
      }

      switch (section) {
        case 'claim':
          if (M !== 'POST') return void fail(res, 405, 'Claiming is a POST.')
          return void send(res, await claimOrg(jwt, handle))

        case 'logo':
        case 'banner':
          if (M !== 'POST') return void fail(res, 405, 'Uploading an image is a POST.')
          return void send(
            res,
            await setOrgImage(jwt, uid, handle, section, await rawBody(req), contentType(req)),
          )

        case 'media':
          if (M !== 'POST') return void fail(res, 405, 'Uploading an image is a POST.')
          return void send(res, await uploadMedia(jwt, uid, await rawBody(req), contentType(req)))

        case 'events':
          if (itemId) {
            if (M !== 'PATCH') return void fail(res, 405, 'PATCH to edit an event.')
            return void send(res, await patchEvent(jwt, uid, handle, decodeURIComponent(itemId), readBody(req)))
          }
          if (M === 'GET') return void send(res, await listEvents(jwt, handle, q))
          if (M === 'POST') return void send(res, await createEvent(jwt, uid, handle, readBody(req)))
          return void fail(res, 405, 'GET to list events, POST to create one.')

        case 'posts':
          if (itemId) {
            if (M !== 'DELETE') return void fail(res, 405, 'DELETE to take a post down.')
            return void send(res, await hidePost(jwt, uid, handle, decodeURIComponent(itemId)))
          }
          if (M === 'GET') return void send(res, await listPosts(jwt, handle))
          if (M === 'POST') return void send(res, await createPost(jwt, uid, handle, readBody(req)))
          return void fail(res, 405, 'GET to list posts, POST to publish one.')

        case 'stories':
          if (M === 'GET') return void send(res, await listStories(jwt, handle))
          if (M === 'POST') return void send(res, await createStory(jwt, uid, handle, readBody(req)))
          return void fail(res, 405, 'GET to list live stories, POST to add one.')

        case 'invites':
          if (itemId) {
            if (M !== 'DELETE') return void fail(res, 405, 'DELETE to revoke an invite.')
            return void send(res, await revokeInvite(jwt, uid, handle, decodeURIComponent(itemId)))
          }
          if (M === 'GET') return void send(res, await listInvites(jwt, handle, origin))
          if (M === 'POST') return void send(res, await createInvite(jwt, uid, handle, readBody(req), origin))
          return void fail(res, 405, 'GET to list invites, POST to create one.')

        case 'team':
          if (M !== 'GET') return void fail(res, 405, 'The team list is read-only here.')
          return void send(res, await getTeam(jwt, handle))

        case 'insights':
          if (M !== 'GET') return void fail(res, 405, 'Insights are read-only.')
          return void send(res, await orgInsights(jwt, handle))

        default:
          fail(res, 404, 'No organisation endpoint called "' + section + '".')
          return
      }
    }

    fail(
      res,
      404,
      'Unknown area. The API has five: /api/v1/owner, /api/v1/me, /api/v1/support, /api/v1/admin and /api/v1/orgs.',
    )
  } catch (err) {
    fail(res, 500, err instanceof Error ? err.message : 'Unexpected error.')
  }
}
