/**
 * Daily mirror of the registrar's per-section deadlines (DNE / DISC / add).
 *
 * NOT ROUTED (leading underscore). It rides the existing daily Moodle cron,
 * the same way failed-parse cleanup does, and is also reachable on its own as
 * `/api/sync-catalog?job=deadlines` behind CRON_SECRET. No new function and
 * no new cron entry: Hobby's limits are both spent.
 *
 * Cost: one GET of a ~145KB page and one upsert of ~190 rows, once a day.
 */
import { createClient } from '@supabase/supabase-js'
import { DEADLINES_PAGE, parseDeadlinesPage, writeDeadlines, type DeadlineWriter } from './_deadlines-parse.js'
import { fail } from './_respond.js'

export async function syncRegistrarDeadlines(supabaseUrl: string, serviceKey: string) {
  const r = await fetch(DEADLINES_PAGE, {
    headers: { 'user-agent': 'ConcordiaTrackerBot/1.0 (+https://concordiatracker.com/about; registrar deadlines)' },
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) throw new Error(`registrar page answered ${r.status}`)
  const rows = parseDeadlinesPage(await r.text())
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  return writeDeadlines(db as unknown as DeadlineWriter, rows)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncDeadlinesJob(req: any, res: any): Promise<void> {
  const secret = process.env.CRON_SECRET
  const header: string = req.headers['authorization'] || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!secret || token !== secret.trim()) {
    fail(res, 401, 'Unauthorized')
    return
  }
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    fail(res, 503, 'Not configured.', { code: 'not_configured' })
    return
  }
  try {
    res.status(200).json(await syncRegistrarDeadlines(url, key))
  } catch (e) {
    fail(res, 502, e instanceof Error ? e.message : 'Sync failed.', { code: 'upstream_error' })
  }
}
