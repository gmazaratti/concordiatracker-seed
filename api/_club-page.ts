/**
 * GET /c/:handle          → the club's public page (server-rendered HTML)
 * GET /sitemap-clubs.xml  → every approved club's public page
 *
 * Served through `sections.ts` (`?feed=club` / `?feed=club-sitemap`, via
 * rewrites) because the Hobby plan allows twelve functions and all twelve are
 * taken — the same arrangement as the shuttle and library feeds.
 *
 * READ WITH THE ANON KEY, never the service role: row-level security already
 * says what the public may see (approved clubs, published events), and a page
 * that anyone on the internet can fetch should be bound by exactly those rules,
 * not by a filter we remembered to write here.
 *
 * Cached at the edge for ten minutes and served stale for a day while it
 * refreshes, so a crawler or a viral link never becomes database load.
 */
import { esc, isTestClub, renderClubPage, SITE, slugOf, type ClubEvent, type ClubOrg } from './_club-html.js'

const HANDLE = /^[a-z0-9][a-z0-9._-]{1,39}$/

function supa(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

async function rest<T>(path: string): Promise<T | null> {
  const s = supa()
  if (!s) return null
  const r = await fetch(`${s.url}/rest/v1/${path}`, {
    headers: { apikey: s.key, Authorization: `Bearer ${s.key}` },
    signal: AbortSignal.timeout(6000),
  })
  return r.ok ? ((await r.json()) as T) : null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function send(res: any, status: number, type: string, body: string, cache: string) {
  res.statusCode = status
  res.setHeader('Content-Type', type)
  res.setHeader('Cache-Control', cache)
  res.end(body)
}

const EDGE = 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400'

function notFound(slug: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Club not found · ConcordiaTracker</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#0f0f16;color:#f2f1f6;font:15px/1.55 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;text-align:center}a{color:#8fb39a}</style></head>
<body><main><h1>No club called @${esc(slug)}</h1><p>It may have changed its handle, or it is not public yet.</p><p><a href="/">ConcordiaTracker</a></p></main></body></html>`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function clubPageHandler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'text/plain; charset=utf-8', 'Use GET.', 'no-store')
    return
  }
  if (!supa()) {
    send(res, 503, 'text/plain; charset=utf-8', 'Club pages are not configured.', 'no-store')
    return
  }

  const slug = String(req.query?.handle ?? '').trim().toLowerCase().replace(/^@/, '')
  if (!HANDLE.test(slug)) {
    send(res, 404, 'text/html; charset=utf-8', notFound(slug.slice(0, 40)), EDGE)
    return
  }

  try {
    const orgs = await rest<(ClubOrg & { id: string })[]>(
      `organizations?select=id,handle,name,verified,glyph,color,logo,banner,bio,links,venue` +
        `&handle=eq.${encodeURIComponent('@' + slug)}&status=eq.approved&limit=1`,
    )
    const org = orgs?.[0]
    if (!org) {
      send(res, 404, 'text/html; charset=utf-8', notFound(slug), EDGE)
      return
    }
    const events =
      (await rest<ClubEvent[]>(
        `events?select=id,title,start,mode,location,image,recurrence` +
          `&org_id=eq.${org.id}&is_draft=eq.false&start=gte.${encodeURIComponent(new Date().toISOString())}` +
          `&order=start.asc&limit=10`,
      )) ?? []
    send(res, 200, 'text/html; charset=utf-8', renderClubPage(org, events), EDGE)
  } catch {
    send(res, 503, 'text/plain; charset=utf-8', 'Could not load this club right now.', 'no-store')
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function clubSitemapHandler(_req: any, res: any) {
  const orgs = (await rest<{ handle: string }[]>(`organizations?select=handle&status=eq.approved&order=handle.asc`).catch(
    () => null,
  )) ?? []
  const urls = orgs
    .map((o) => slugOf(o.handle))
    .filter((s) => HANDLE.test(s) && !isTestClub(s))
    .map((s) => `  <url>\n    <loc>${SITE}/c/${esc(s)}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`)
  send(
    res,
    200,
    'application/xml; charset=utf-8',
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
    'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
  )
}
