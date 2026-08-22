import { OPENAPI } from './_openapi.js'

/**
 * Serves the OpenAPI document.
 *
 * Reachable at /openapi.json (rewritten in vercel.json) and at /api/openapi.
 * CORS is open on purpose: a spec no browser-based agent can fetch is a spec
 * nobody reads.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function handler(_req: any, res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600')
  res.status(200).send(JSON.stringify(OPENAPI, null, 2))
}
