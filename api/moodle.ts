/**
 * POST /api/moodle — connect, disconnect, or refresh a Moodle calendar.
 *
 * `{ action: 'connect', url }`  validate the link, prove it works, store it
 * `{ action: 'sync' }`          re-read it now
 * `{ action: 'disconnect' }`    forget the link and remove what it added
 *
 * WHY THE SERVER HOLDS THE LINK AT ALL. Two independent reasons, and both had
 * to be true before this was worth building:
 *   1. moodle.concordia.ca sends no CORS headers, so the browser cannot read
 *      the response even with the student signed in. Someone has to fetch it
 *      server-side.
 *   2. Sync means re-reading it later, when the student is not here.
 *
 * WHY CONNECTING IS NOT A DIRECT INSERT. If the client could write the row, it
 * could write any URL — including an internal address — and make our server
 * fetch it and report the result back. That is server-side request forgery,
 * with us as the confused deputy. `validateMoodleIcsUrl` pins the host to
 * concordia.ca and the path to the export endpoint BEFORE anything is stored,
 * and the database has no insert policy at all so this is the only door.
 */
import { validateMoodleIcsUrl } from './_ics.js'
import { fetchMoodleCalendar, eventsToTodos, writeMoodleTodos, recordMoodleSync, syncOneConnection } from './_moodle.js'
import { fail } from './_respond.js'

export const config = { maxDuration: 30 }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    fail(res, 405, 'Method not allowed', { hint: 'POST a JSON body with an `action`.' })
    return
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceKey) {
    fail(res, 500, 'Moodle sync is not configured on this server.', { code: 'not_configured' })
    return
  }

  // ── Who is asking ─────────────────────────────────────────────────────────
  const auth: string = req.headers?.authorization ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) {
    fail(res, 401, 'Sign in to connect Moodle.')
    return
  }
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!who.ok) {
    fail(res, 401, 'Your session expired — sign in again.')
    return
  }
  const userId = ((await who.json()) as { id?: string }).id
  if (!userId) {
    fail(res, 401, 'Your session expired — sign in again.')
    return
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : (req.body ?? {})
  const action = String((body as { action?: string }).action ?? '')

  const svc = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  // ── connect ───────────────────────────────────────────────────────────────
  if (action === 'connect') {
    const raw = String((body as { url?: string }).url ?? '')
    const checked = validateMoodleIcsUrl(raw)
    if (!checked.ok) {
      fail(res, 400, checked.reason, { hint: 'In Moodle: Calendar → Export → Get calendar URL.' })
      return
    }

    // PROVE IT WORKS BEFORE STORING IT. A link saved without being tried is a
    // connection that looks fine tonight and has silently never worked.
    const probe = await fetchMoodleCalendar(checked.url)
    if (!probe.ok) {
      fail(res, 400, probe.error ?? 'That link did not work.', {
        code: 'upstream_error',
        hint: 'Copy the link again from Moodle — the token changes if you reset it.',
      })
      return
    }

    const up = await fetch(`${supabaseUrl}/rest/v1/moodle_connections?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...svc, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: userId,
        ics_url: checked.url,
        status: 'active',
        last_sync_at: new Date().toISOString(),
        last_error: null,
        event_count: probe.events.length,
      }),
    })
    if (!up.ok) {
      fail(res, 500, 'Could not save that connection. Try again in a moment.', {
        code: 'internal_error',
      })
      return
    }

    const rows = eventsToTodos(probe.events, userId, new Date())
    const written = await writeMoodleTodos(rows, supabaseUrl, serviceKey)
    if (written.error) {
      await recordMoodleSync(userId, { ok: false, count: 0, error: written.error }, supabaseUrl, serviceKey)
      fail(res, 500, written.error, { code: 'internal_error' })
      return
    }

    /**
     * Return the ITEMS, not just a tally.
     *
     * "5 deadlines checked" is a claim the student has no way to check, and
     * this whole feature asks them to trust a link they cannot read. Handing
     * back what was actually found — and how many of the feed's events were
     * left behind as already finished — is the difference between a number and
     * evidence.
     */
    res.status(200).json({
      connected: true,
      found: probe.events.length,
      imported: written.written,
      items: preview(rows),
    })
    return
  }

  // ── sync ──────────────────────────────────────────────────────────────────
  if (action === 'sync') {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/moodle_connections?user_id=eq.${userId}&select=ics_url`,
      { headers: svc },
    )
    const rows = r.ok ? ((await r.json()) as { ics_url: string }[]) : []
    if (rows.length === 0) {
      fail(res, 404, 'No Moodle calendar is connected to this account.', {
        hint: 'Connect one first with action "connect".',
      })
      return
    }
    const out = await syncOneConnection(userId, rows[0].ics_url, supabaseUrl, serviceKey, new Date())
    if (!out.ok) {
      fail(res, 502, out.error ?? 'Sync failed.', { code: 'upstream_error' })
      return
    }
    res.status(200).json({
      synced: true,
      imported: out.count,
      found: out.found ?? out.count,
      items: preview(out.rows ?? []),
    })
    return
  }

  // ── disconnect ────────────────────────────────────────────────────────────
  if (action === 'disconnect') {
    // Through the RPC so the removal of the synced items and the removal of
    // the link happen under one definition, not two calls that can half-fail.
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/disconnect_moodle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (!r.ok) {
      fail(res, 500, 'Could not disconnect. Try again in a moment.', { code: 'internal_error' })
      return
    }
    res.status(200).json({ connected: false, removed: await r.json() })
    return
  }

  fail(res, 400, 'Unknown action.', {
    hint: 'Use "connect", "sync" or "disconnect".',
  })
}

/**
 * The rows, trimmed for the wire and sorted the way a person reads them.
 *
 * Capped at 50 because a year-long calendar can hold hundreds and nobody
 * scrolls a settings panel that far; the count beside the list is the honest
 * total, so a cap never looks like a loss.
 */
function preview(rows: { title: string; due: string; note: string | null; moved_from?: string | null }[]) {
  return [...rows]
    .sort((a, b) => a.due.localeCompare(b.due))
    .slice(0, 50)
    .map((r) => ({ title: r.title, due: r.due, note: r.note, movedFrom: r.moved_from ?? null }))
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
