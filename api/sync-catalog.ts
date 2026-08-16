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
import { fetchCatalog, fetchDescriptions, type CatalogRow } from './_concordia.js'

/**
 * Vercel kills a function at its duration limit with no response and no error,
 * which is what wrote 1,946 of ~7,946 rows and then vanished. 60s is the
 * ceiling on Hobby and well within Pro's.
 */
export const config = { maxDuration: 60 }

/**
 * 2,000 rows per request rather than 500.
 *
 * The whole catalogue is ~1.4MB, so a chunk this size is roughly 350KB - large
 * for a request, small for PostgREST - and it turns sixteen sequential
 * round-trips into four. Latency per round-trip, not row count, was the cost.
 */
const CHUNK = 2000

/** How many chunks are in flight at once. Four requests, run together, is the
 *  difference between comfortably inside the limit and being killed by it. */
const CONCURRENCY = 4

/** One catalogue row as the mirror stores it. */
function toRow(c: CatalogRow, description: string | null) {
  return {
    id: c.ID,
    subject: c.subject,
    catalog: c.catalog,
    title: c.title ?? '',
    career: c.career ?? null,
    class_unit: c.classUnit ? Number(c.classUnit) : null,
    prerequisites: c.prerequisites ?? null,
    crosslisted: c.crosslisted ?? null,
    description,
    synced_at: new Date().toISOString(),
  }
}

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
    // Both in parallel: two independent endpoints, and the descriptions are
    // the slower of the two.
    const [courses, descriptions] = await Promise.all([
      fetchCatalog(),
      // A missing description is a missing paragraph, not a failed sync, so a
      // fault here must not cost us the catalogue.
      fetchDescriptions().catch(() => []),
    ])
    const describedBy = new Map(descriptions.map((d) => [d.ID, d.description]))
    if (courses.length === 0) {
      // Never wipe a good mirror because one fetch came back empty.
      res.status(502).json({ error: 'Catalogue returned no courses; keeping the existing mirror.' })
      return
    }

    /**
     * Collapse duplicate IDs before writing.
     *
     * Concordia returns the same course several times - their own documented
     * example shows ID 002625 repeated on consecutive rows - and PostgREST
     * cannot upsert two rows sharing the conflict key in one request. Postgres
     * rejects the WHOLE batch with "ON CONFLICT DO UPDATE command cannot affect
     * row a second time", so one duplicate anywhere in a chunk loses all 2,000
     * rows with it. That is why a larger chunk size made the write go from
     * partial to zero: bigger batches are likelier to contain a repeat.
     *
     * Last occurrence wins. The duplicates carry identical data, so which one
     * survives does not matter; that they are deduplicated does.
     */
    const byId = new Map<string, ReturnType<typeof toRow>>()
    for (const c of courses) {
      if (!c.subject || !c.catalog) continue
      byId.set(c.ID, toRow(c, describedBy.get(c.ID) ?? null))
    }
    const rows = [...byId.values()]



    // Chunked so one oversized request can't time out the whole sync, and run
    // with limited concurrency so the whole job fits inside the duration limit.
    const slices: (typeof rows)[] = []
    for (let i = 0; i < rows.length; i += CHUNK) slices.push(rows.slice(i, i + CHUNK))

    let written = 0
    let firstError: string | null = null

    const upsert = async (slice: typeof rows) => {
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

    for (let i = 0; i < slices.length; i += CONCURRENCY) {
      await Promise.all(slices.slice(i, i + CONCURRENCY).map(upsert))
    }

    // A sync that wrote nothing is a failed sync. Returning 200 here is how a
    // completely broken run got mistaken for a successful one: the caller saw
    // a 200, believed the catalogue was populated, and only found out later
    // that every page depending on it was empty.
    if (written === 0) {
      res.status(502).json({
        error: 'Fetched the catalogue but wrote nothing.',
        fetched: courses.length,
        unique: rows.length,
        cause: firstError ?? 'No rows survived filtering.',
      })
      return
    }

    res.status(written < rows.length ? 207 : 200).json({
      fetched: courses.length,
      unique: rows.length,
      described: descriptions.length,
      written,
      ...(firstError ? { partialFailure: firstError } : {}),
    })
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Sync failed.' })
  }
}
