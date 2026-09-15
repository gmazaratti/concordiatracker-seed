/**
 * Moodle calendar sync — the engine, shared by the user-facing endpoint and
 * the nightly cron.
 *
 * WHY THIS IS A SERVER JOB AND NOT A BROWSER ONE: moodle.concordia.ca sends no
 * CORS headers, so a page on our origin cannot read the response even though
 * the student is signed in. The fetch has to happen from a server, which is
 * also why we end up holding the token (see db/moodle_sync.sql for how it is
 * kept unreadable through the API).
 *
 * WHAT IT MEASURED BEFORE BEING WRITTEN, so a future reader does not re-derive
 * it: with a browser User-Agent, `moodle.concordia.ca/moodle/` returns a real
 * 200, and `calendar/export_execute.php` with a bad token returns the string
 * "Invalid authentication". With curl's default agent both return 202 and an
 * empty body — there is a User-Agent filter in front of the site, which is why
 * every request here sends a browser one. That is not evasion of an access
 * control: the content is the student's own, fetched with their own token, at
 * their explicit request.
 */
import { parseIcs, eventsToTodos, markMoves, type IcsEvent, type MoodleTodoRow } from './_ics.js'

// Re-exported so callers have one import for the feature; the definitions
// live in _ics.ts because they are pure and that is what makes them testable
// without Node resolving this module's network imports.
export { eventsToTodos, markMoves, type MoodleTodoRow }

/** A real browser UA. Concordia's edge returns an empty 202 without one. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

/** Their server, their bandwidth — one calendar per person per night is tiny,
 *  but the timeout keeps a hung fetch from holding a function open. */
const FETCH_TIMEOUT_MS = 15_000

/** Guard against a pathological feed. A year of deadlines is ~200 events. */
const MAX_EVENTS = 1000

export interface MoodleFetchResult {
  ok: boolean
  events: IcsEvent[]
  /** Set when ok is false — shown to the student verbatim, so it is a sentence. */
  error?: string
}

/**
 * Fetch and parse one student's Moodle calendar.
 *
 * Every failure mode gets its own sentence. "Sync failed" teaches nobody
 * anything, and the three real causes need three different actions from the
 * student: re-copy the link, wait, or tell us.
 */
export async function fetchMoodleCalendar(icsUrl: string): Promise<MoodleFetchResult> {
  let res: Response
  try {
    res = await fetch(icsUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': UA, Accept: 'text/calendar, text/plain, */*' },
      redirect: 'follow',
    })
  } catch (err) {
    const timedOut = (err as Error)?.name === 'TimeoutError'
    return {
      ok: false,
      events: [],
      error: timedOut
        ? 'Moodle did not answer in time. This usually clears on its own — we will try again tonight.'
        : 'Could not reach Moodle just now. We will try again tonight.',
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      events: [],
      error: `Moodle answered ${res.status}. If this keeps happening, get a fresh calendar link from Moodle and reconnect.`,
    }
  }

  const body = await res.text()

  // Moodle returns 200 with a plain-text error for a dead token rather than a
  // 401, so the status code alone cannot tell us this went wrong.
  if (/invalid authentication/i.test(body.slice(0, 200))) {
    return {
      ok: false,
      events: [],
      error: 'Moodle rejected the link. Its token was probably reset — get a new calendar URL from Moodle and reconnect.',
    }
  }
  if (!body.includes('BEGIN:VCALENDAR')) {
    return {
      ok: false,
      events: [],
      error: 'That link did not return a calendar. Re-copy it from Moodle: Calendar → Export → Get calendar URL.',
    }
  }

  const events = parseIcs(body).slice(0, MAX_EVENTS)
  return { ok: true, events }
}

/**
 * Write the rows, then report what happened.
 *
 * Upserts on (user_id, external_id) — the unique index from the migration — so
 * running twice changes nothing and a moved deadline moves in place.
 *
 * NOTHING IS DELETED. If an event disappears from Moodle we leave ours alone:
 * the student may have ticked it off, and silently removing something they
 * were relying on is worse than leaving one stale row they can delete.
 */
export async function writeMoodleTodos(
  rows: MoodleTodoRow[],
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ written: number; error?: string }> {
  if (rows.length === 0) return { written: 0 }
  const res = await fetch(
    `${supabaseUrl}/rest/v1/todos?on_conflict=user_id,external_id`,
    {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        // merge-duplicates = update the row that is already there.
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
  )
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200)
    return { written: 0, error: `Could not save the deadlines (${res.status}). ${detail}` }
  }
  return { written: rows.length }
}

/** Record the outcome so the student can see it without asking us. */
export async function recordMoodleSync(
  userId: string,
  result: { ok: boolean; count: number; error?: string },
  supabaseUrl: string,
  serviceKey: string,
): Promise<void> {
  await fetch(`${supabaseUrl}/rest/v1/moodle_connections?user_id=eq.${userId}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      status: result.ok ? 'active' : 'error',
      last_sync_at: new Date().toISOString(),
      last_error: result.ok ? null : (result.error ?? 'Unknown error'),
      event_count: result.count,
    }),
  })
}

/**
 * What we currently hold for this person, as UID → due.
 *
 * A failure here returns an EMPTY map, which makes every row look new and
 * therefore unmoved. That is the right way to fail: the sync still runs and
 * the dates are still correct, and the only thing lost is a "moved from" note.
 * Losing the whole night's sync over it would be the worse trade.
 */
async function existingDues(
  userId: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/todos?select=external_id,due&user_id=eq.${userId}&source=eq.moodle`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    )
    if (!r.ok) return out
    for (const row of (await r.json()) as { external_id: string | null; due: string | null }[]) {
      if (row.external_id && row.due) out.set(row.external_id, row.due)
    }
  } catch {
    /* an empty map means "nothing moved", which is the safe answer */
  }
  return out
}

/**
 * One student, end to end. Used by both the "Sync now" button and the cron.
 */
export async function syncOneConnection(
  userId: string,
  icsUrl: string,
  supabaseUrl: string,
  serviceKey: string,
  now: Date,
): Promise<{ ok: boolean; count: number; error?: string }> {
  const fetched = await fetchMoodleCalendar(icsUrl)
  if (!fetched.ok) {
    const out = { ok: false, count: 0, error: fetched.error }
    await recordMoodleSync(userId, out, supabaseUrl, serviceKey)
    return out
  }
  // Read what we already hold BEFORE upserting, so a changed deadline can be
  // reported as a change rather than silently rewritten.
  const previous = await existingDues(userId, supabaseUrl, serviceKey)
  const rows = markMoves(eventsToTodos(fetched.events, userId, now), previous)
  const written = await writeMoodleTodos(rows, supabaseUrl, serviceKey)
  const out = written.error
    ? { ok: false, count: 0, error: written.error }
    : { ok: true, count: written.written }
  await recordMoodleSync(userId, out, supabaseUrl, serviceKey)
  return out
}
