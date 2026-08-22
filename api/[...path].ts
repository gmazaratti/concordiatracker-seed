import { fail } from './_respond.js'

/**
 * Anything under /api/ that no handler claims.
 *
 * Without this, Vercel answers an unknown API path with its own HTML error
 * page, which is unparseable to a client that asked for JSON — and to an agent
 * probing the surface it looks like the API is broken rather than like the path
 * is wrong. Vercel matches concrete files before this catch-all, so adding a
 * real endpoint always wins over it.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(req: any, res: any) {
  const path = String(req.url ?? '').split('?')[0]
  fail(res, 404, `No API endpoint at ${path}.`, {
    code: 'not_found',
    hint: 'Every endpoint this API exposes is listed at https://concordiatracker.com/openapi.json.',
  })
}
