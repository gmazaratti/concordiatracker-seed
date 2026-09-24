/**
 * The nightly Moodle refresh — every connected calendar, one pass.
 *
 * Reached as `/api/sync-catalog?job=moodle` rather than its own route, for the
 * same reason the outline sync is: Hobby allows 12 Serverless Functions and a
 * thirteenth fails the entire deploy. See the note in sync-catalog.ts.
 */
import { cleanupFailedParses } from './_parse-cleanup.js'
import { syncOneConnection } from './_moodle.js'
import { fail } from './_respond.js'

/**
 * How many students per run.
 *
 * Each one is a fetch to Concordia plus an upsert, so the limit is wall-clock,
 * not correctness — anyone not reached tonight is reached tomorrow, and can
 * always press "Sync now". Sized to finish well inside the 60s ceiling: the
 * job being killed halfway would leave the LAST person's status mid-update,
 * which is exactly the failure mode that wrote 1,946 catalogue rows and
 * reported success.
 */
const MAX_PER_RUN = 120

/** Their server. Sequential, with a pause, rather than 120 at once. */
const POLITE_MS = 250

interface ConnRow {
  user_id: string
  ics_url: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncMoodle(req: any, res: any): Promise<void> {
  const secret = process.env.CRON_SECRET
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret || !supabaseUrl || !serviceKey) {
    fail(res, 500, 'Moodle sync is not configured.', { code: 'not_configured' })
    return
  }
  const auth: string = req.headers?.authorization ?? ''
  if (auth.replace('Bearer ', '').trim() !== secret.trim()) {
    fail(res, 401, 'Unauthorized')
    return
  }

  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  // Daily housekeeping that needs no function of its own (see _parse-cleanup.ts).
  await cleanupFailedParses(supabaseUrl, serviceKey)

  /**
   * Oldest-checked first, so a run that is cut short still makes progress and
   * nobody can be starved: whoever waited longest goes next time too.
   * `nullsfirst` puts a brand-new connection at the front.
   */
  const r = await fetch(
    `${supabaseUrl}/rest/v1/moodle_connections` +
      `?select=user_id,ics_url&status=neq.paused` +
      `&order=last_sync_at.asc.nullsfirst&limit=${MAX_PER_RUN}`,
    { headers: svc },
  )
  if (!r.ok) {
    fail(res, 502, `Could not list connections (${r.status}).`, { code: 'upstream_error' })
    return
  }
  const rows = (await r.json()) as ConnRow[]

  const now = new Date()
  let ok = 0
  let failed = 0
  let imported = 0
  const errors: string[] = []

  for (const row of rows) {
    // One person's dead token must not end the run for everyone behind them.
    try {
      const out = await syncOneConnection(row.user_id, row.ics_url, supabaseUrl, serviceKey, now)
      if (out.ok) {
        ok++
        imported += out.count
      } else {
        failed++
        if (errors.length < 5 && out.error) errors.push(out.error)
      }
    } catch (e) {
      failed++
      if (errors.length < 5) errors.push((e as Error)?.message ?? 'unknown')
    }
    if (POLITE_MS) await new Promise((rs) => setTimeout(rs, POLITE_MS))
  }

  res.status(200).json({
    job: 'moodle',
    connections: rows.length,
    ok,
    failed,
    imported,
    // A sample, not the lot: enough to see the shape of a systemic failure
    // (every token rejected = something changed at Concordia) without dumping
    // 120 near-identical strings into a log.
    sampleErrors: errors,
    // Truncated means there are more waiting; they go first next run.
    truncated: rows.length === MAX_PER_RUN,
  })
}
