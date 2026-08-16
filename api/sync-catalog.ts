/**
 * POST /api/sync-catalog - mirrors Concordia's course catalogue into Supabase.
 *
 * Gated by CRON_SECRET like the reminders job, so the public can't trigger a
 * 1.4MB fetch and 8,000 upserts on a whim.
 *
 * Run weekly. The catalogue changes about once a year; the only reason not to
 * run it less often is that a new course appearing mid-year should show up
 * without anyone remembering to press a button.
 */
import { fetchCatalog } from './_concordia.js'

const CHUNK = 500

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const cronSecret = process.env.CRON_SECRET
  const header: string = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!cronSecret || token !== cronSecret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    res.status(500).json({ error: 'Supabase is not configured.' })
    return
  }

  try {
    const courses = await fetchCatalog()
    if (courses.length === 0) {
      // Never wipe a good mirror because one fetch came back empty.
      res.status(502).json({ error: 'Catalogue returned no courses; keeping the existing mirror.' })
      return
    }

    const rows = courses
      .filter((c) => c.subject && c.catalog)
      .map((c) => ({
        id: c.ID,
        subject: c.subject,
        catalog: c.catalog,
        title: c.title ?? '',
        career: c.career ?? null,
        class_unit: c.classUnit ? Number(c.classUnit) : null,
        prerequisites: c.prerequisites ?? null,
        crosslisted: c.crosslisted ?? null,
        synced_at: new Date().toISOString(),
      }))

    // Chunked so one oversized request can't time out the whole sync.
    let written = 0
    let firstError: string | null = null
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      const r = await fetch(`${url}/rest/v1/course_catalog?on_conflict=id`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(slice),
      })
      if (r.ok) {
        written += slice.length
      } else if (firstError === null) {
        // Keep the FIRST failure: later chunks tend to fail the same way, and
        // the first one is the one that explains why.
        firstError = `${r.status} ${(await r.text()).slice(0, 300)}`
      }
    }

    // A sync that wrote nothing is a failed sync. Returning 200 here is how a
    // completely broken run got mistaken for a successful one: the caller saw
    // a 200, believed the catalogue was populated, and only found out later
    // that every page depending on it was empty.
    if (written === 0) {
      res.status(502).json({
        error: 'Fetched the catalogue but wrote nothing.',
        fetched: courses.length,
        cause: firstError ?? 'No rows survived filtering.',
      })
      return
    }

    res.status(written < rows.length ? 207 : 200).json({
      fetched: courses.length,
      written,
      ...(firstError ? { partialFailure: firstError } : {}),
    })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Sync failed.' })
  }
}
