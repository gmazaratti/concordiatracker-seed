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
 * SCOPE. Deliberately matched to a single page for its first deploy. If
 * returning `undefined` does not fall through to the static asset the way it is
 * documented to, exactly one page breaks instead of the homepage and all 36
 * docs pages. Widen the matcher once the behaviour is confirmed in production.
 */
export const config = {
  matcher: ['/developers'],
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const accept = request.headers.get('accept') ?? ''

  // Anything not explicitly asking for markdown falls through to the static
  // HTML, untouched.
  if (!/text\/markdown/i.test(accept)) return undefined

  const url = new URL(request.url)
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
