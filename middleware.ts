/**
 * Markdown content negotiation, done at the edge.
 *
 * WHY THIS EXISTS. The obvious mechanism — a `has` condition on an `accept`
 * header in vercel.json — was deployed and measured, and does not fire: a
 * request for /docs/radar with `Accept: text/markdown` came back
 * `X-Vercel-Cache: MISS` and `Content-Type: text/html`, so it reached the
 * routing layer and the condition still did not match.
 *
 * There is also a mechanism problem the `has` approach could never solve.
 * Vercel evaluates rewrites AFTER the filesystem, and `/` resolves to a real
 * `index.html`, so no rewrite is ever consulted for the homepage. Middleware
 * runs before both, which is the only place `/` can be intercepted.
 *
 * SCOPE. This shipped matched to /developers alone, and was widened only after
 * production confirmed both halves: `Accept: text/markdown` returned
 * `text/markdown` with `X-Content-Negotiation: middleware`, and a browser
 * `Accept` header still returned the full 10,479-byte HTML page. The
 * fall-through is the risky half, and it is the half that was measured.
 */
export const config = {
  matcher: ['/', '/about', '/contact', '/developers', '/docs/:path*', '/api/:path*'],
}

/**
 * THE APP STORE APP CALLS THE API CROSS-ORIGIN.
 *
 * Its pages are served from `capacitor://localhost`, so every `/api/*` call
 * (rewritten to this domain in src/lib/native.ts) is cross-origin and, because
 * it carries an Authorization header, is preceded by a CORS preflight. The
 * functions themselves answer OPTIONS with 405, which fails a preflight, so it
 * is answered here, before them, and only for that one origin. The matching
 * `Access-Control-Allow-Origin` on the real responses is a static header in
 * vercel.json. Browsers on the website are same-origin and never preflight.
 */
const APP_ORIGIN = 'capacitor://localhost'

function preflight(request: Request): Response | undefined {
  if (request.method !== 'OPTIONS') return undefined
  if (request.headers.get('origin') !== APP_ORIGIN) return undefined
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': APP_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        request.headers.get('access-control-request-headers') ?? 'authorization, content-type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  })
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  // The API only ever needs the preflight answer; everything else falls
  // through to the function untouched.
  if (new URL(request.url).pathname.startsWith('/api/')) return preflight(request)

  const accept = request.headers.get('accept') ?? ''

  // Anything not explicitly asking for markdown falls through to the static
  // HTML, untouched.
  if (!/text\/markdown/i.test(accept)) return undefined

  const url = new URL(request.url)
  // A request for the .md file itself already matches the matcher; without this
  // it would look for <file>.md/index.md, 404, and fall through anyway — right
  // answer, wasted round trip.
  if (url.pathname.endsWith('.md')) return undefined
  const clean = url.pathname.replace(/\/$/, '')
  const target = new URL(clean === '' ? '/index.md' : `${clean}/index.md`, url.origin)

  // Fetching the generated .md by its own URL keeps this stateless — no file
  // system access, no bundled copies of the content. The path differs from the
  // request path, so this cannot re-enter the matcher and loop.
  const res = await fetch(target, { headers: { accept: 'text/plain' } })
  if (!res.ok) return undefined

  return new Response(await res.text(), {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      // Both representations must declare this or a shared cache will hand one
      // caller's variant to the next.
      Vary: 'Accept, Accept-Encoding',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Content-Negotiation': 'middleware',
    },
  })
}
