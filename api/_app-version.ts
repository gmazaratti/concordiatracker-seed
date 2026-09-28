/**
 * GET /api/app-version?platform=ios
 *
 * The minimum and latest native build, read from `public.app_versions`
 * (db/app_versions.sql, edited from Admin → App version). Served through
 * `sections.ts` (`?feed=app-version`, via a rewrite) because the platform
 * allows twelve functions and every one is taken.
 *
 * Public on purpose: the check runs before anyone signs in, and a build number
 * is not a secret. Short edge cache, so raising the minimum reaches phones
 * within a minute without every launch hitting the database.
 *
 * The client FAILS OPEN on anything other than a clean 200, so an error here
 * can never stop the app launching.
 */
import { fail } from './_respond.js'

const PLATFORMS = new Set(['ios'])

export interface AppVersionInfo {
  platform: string
  minBuild: number
  latestBuild: number
  storeUrl: string
  updatedAt: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function appVersionHandler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fail(res, 405, 'Use GET.', { code: 'method_not_allowed' })
    return
  }
  const platform = String(req.query?.platform ?? 'ios').toLowerCase()
  if (!PLATFORMS.has(platform)) {
    fail(res, 400, 'Unknown platform. Use platform=ios.', { code: 'bad_request' })
    return
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    fail(res, 503, 'Version check is not configured.', { code: 'not_configured' })
    return
  }

  try {
    const r = await fetch(
      `${url}/rest/v1/app_versions?select=platform,min_build,latest_build,store_url,updated_at&platform=eq.${platform}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(5000) },
    )
    const rows = r.ok ? ((await r.json()) as Array<Record<string, unknown>>) : null
    const row = rows?.[0]
    if (!row) {
      fail(res, 503, 'No version information for this platform.', { code: 'upstream_error' })
      return
    }
    const body: AppVersionInfo = {
      platform,
      minBuild: Number(row.min_build),
      latestBuild: Number(row.latest_build),
      storeUrl: String(row.store_url),
      updatedAt: String(row.updated_at),
    }
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=60')
    res.status(200).json(body)
  } catch {
    fail(res, 503, 'Could not read version information.', { code: 'upstream_error' })
  }
}
