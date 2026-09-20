/**
 * Calendar sync.
 *
 *   GET  /api/calendar/<token>.ics   the feed itself — no session, by design
 *   POST /api/calendar               { action: enable | rotate | disable | layers }
 *
 * WHY THE FEED HAS NO AUTH. Google fetches a subscribed calendar from Google's
 * servers, hours later, with no cookie and no header of ours. Nothing we could
 * put behind a session would ever be read. The URL itself is the credential:
 * 256 bits, minted server-side, and revocable in one click — see the header of
 * `db/calendar_feed.sql`.
 *
 * WHY ONE-WAY. Writing into someone's Google calendar means holding an OAuth
 * token, refreshing it forever, and keeping two copies of a date in step; the
 * moment a professor moves a deadline our copy in their calendar is wrong
 * until we successfully push again. A subscription has one copy. Theirs
 * re-reads ours, so it cannot drift, and the same URL works in Apple Calendar
 * and Outlook, neither of which would have been reachable any other way.
 */
import { buildIcs, type IcsOutEvent } from './_ics.js'
import { fail } from './_respond.js'

export const config = { maxDuration: 20 }

/** How much of the calendar the feed carries. Far enough back that last
 *  month's work is still there, far enough forward for a full degree plan,
 *  and bounded so the file stays small enough to fetch every few hours. */
const PAST_DAYS = 60
const FUTURE_DAYS = 400

const SITE = process.env.PUBLIC_SITE_URL || 'https://concordiatracker.com'

interface FeedRow {
  user_id: string
  token: string
  include_assessments: boolean
  include_tasks: boolean
}

interface ProfileRow {
  plan_status: string | null
  pro_until: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function handler(req: any, res: any) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !anonKey || !serviceKey) {
    fail(res, 500, 'Calendar sync is not configured on this server.', { code: 'not_configured' })
    return
  }
  const svc = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  }

  if (req.method === 'GET') return serveFeed(req, res, supabaseUrl, svc)
  if (req.method !== 'POST') {
    fail(res, 405, 'Method not allowed', { hint: 'GET the feed, or POST an `action`.' })
    return
  }
  return manage(req, res, supabaseUrl, anonKey, svc)
}

/* ── The feed ─────────────────────────────────────────────────────────────── */

async function serveFeed(req: any, res: any, url: string, svc: Record<string, string>) {
  // `/api/calendar/<token>.ics` arrives here through a rewrite; the `.ics`
  // suffix is stripped because Apple wants to see one on the URL and Google
  // does not care.
  const raw = String(req.query?.token ?? '').replace(/\.ics$/i, '')
  // Checked before it reaches the database: a token is 64 hex characters and
  // nothing else, so a probe with a quoted string never becomes a query.
  if (!/^[0-9a-f]{64}$/.test(raw)) {
    notFound(res)
    return
  }

  const r = await fetch(
    `${url}/rest/v1/calendar_feeds?token=eq.${raw}&select=user_id,token,include_assessments,include_tasks`,
    { headers: svc },
  )
  const rows = r.ok ? ((await r.json()) as FeedRow[]) : []
  const feed = rows[0]
  if (!feed) {
    // The same answer a rotated link gets. Whoever holds an old URL learns
    // nothing about whether it was ever real.
    notFound(res)
    return
  }

  const now = Date.now()
  const pro = await isPro(url, svc, feed.user_id)

  // A LAPSED PASS EXPLAINS ITSELF IN THE CALENDAR.
  //
  // Serving a 404 or an empty file would make the student's deadlines quietly
  // disappear from their phone with nothing anywhere saying why — they would
  // reasonably conclude the feature is broken, and they would be half right.
  // One event, on today, that says what happened and links to Billing.
  if (!pro) {
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
    // Same reason as below: a renewed pass must not wait out a cache.
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).send(
      buildIcs({
        name: 'ConcordiaTracker (paused)',
        description: 'Calendar sync is part of the Semester pass.',
        now,
        events: [
          {
            uid: `paused-${feed.token.slice(0, 12)}@concordiatracker.com`,
            start: new Date(now).toISOString(),
            durationMinutes: 15,
            summary: 'ConcordiaTracker sync is paused',
            description:
              'Your Semester pass has ended, so this calendar has stopped updating. Your deadlines are all still in ConcordiaTracker. Renew and they come back here on the next refresh.',
            url: `${SITE}/app?settings=billing`,
          },
        ],
      }),
    )
    void touch(url, svc, feed.token, req)
    return
  }

  const from = new Date(now - PAST_DAYS * 86_400_000).toISOString()
  const to = new Date(now + FUTURE_DAYS * 86_400_000).toISOString()
  const events: IcsOutEvent[] = []

  if (feed.include_assessments) {
    const [items, courses] = await Promise.all([
      getJson<AssignmentRow[]>(
        `${url}/rest/v1/assignments?user_id=eq.${feed.user_id}&deleted=is.false&date=gte.${from}&date=lte.${to}` +
          `&select=id,course_id,title,date,type,weight,done,custom_course_code&order=date`,
        svc,
      ),
      getJson<CourseRow[]>(
        `${url}/rest/v1/courses?user_id=eq.${feed.user_id}&select=id,code`,
        svc,
      ),
    ])
    const codeOf = new Map((courses ?? []).map((c) => [c.id, c.code]))
    for (const a of items ?? []) {
      if (!a.date) continue // an undated item is not a calendar entry, ever
      const code = (a.course_id ? codeOf.get(a.course_id) : null) ?? a.custom_course_code ?? ''
      const bits = [a.type, a.weight ? `${a.weight}%` : null].filter(Boolean).join(' · ')
      events.push({
        uid: `a-${a.id}@concordiatracker.com`,
        // The block ENDS at the deadline, so the busy bar in a week view sits
        // before the moment it is due rather than after it.
        start: new Date(new Date(a.date).getTime() - 30 * 60_000).toISOString(),
        durationMinutes: 30,
        summary: `${a.done ? '✓ ' : ''}${code ? `${code} · ` : ''}${a.title}`,
        description: [bits, 'Tracked in ConcordiaTracker'].filter(Boolean).join('\n'),
        url: a.course_id ? `${SITE}/app/courses/${a.course_id}` : `${SITE}/app`,
      })
    }
  }

  if (feed.include_tasks) {
    const todos = await getJson<TodoRow[]>(
      `${url}/rest/v1/todos?user_id=eq.${feed.user_id}&due=gte.${from}&due=lte.${to}` +
        `&select=id,title,due,note,done,source&order=due`,
      svc,
    )
    for (const t of todos ?? []) {
      if (!t.due) continue
      events.push({
        uid: `t-${t.id}@concordiatracker.com`,
        start: new Date(new Date(t.due).getTime() - 30 * 60_000).toISOString(),
        durationMinutes: 30,
        summary: `${t.done ? '✓ ' : ''}${t.title}`,
        description: [t.note, t.source === 'moodle' ? 'From your Moodle calendar' : null]
          .filter(Boolean)
          .join('\n'),
        url: `${SITE}/app/calendar`,
      })
    }
  }

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="concordiatracker.ics"')
  /**
   * NOT CACHED, and this was measured rather than reasoned about.
   *
   * With `s-maxage=900` the edge served the OLD link for fifteen minutes
   * after a rotate — so the one control the UI calls a revoke button did not
   * revoke, which is the worst possible thing to be wrong about here. The
   * same cache also swallowed the fetch, leaving the panel reporting "nothing
   * has read this yet" when Google just had.
   *
   * There is nothing to protect: this is one student's calendar, read a
   * handful of times a day by their own devices. Two queries per fetch is a
   * fair price for a revoke that is instant and a counter that is true.
   */
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(
    buildIcs({
      name: 'ConcordiaTracker',
      description: 'Your deadlines, kept up to date by ConcordiaTracker.',
      now,
      events,
    }),
  )

  void touch(url, svc, feed.token, req)
}

/* ── Managing it ──────────────────────────────────────────────────────────── */

async function manage(
  req: any,
  res: any,
  url: string,
  anonKey: string,
  svc: Record<string, string>,
) {
  const auth: string = req.headers?.authorization ?? ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!jwt) {
    fail(res, 401, 'Sign in to set up calendar sync.')
    return
  }
  const who = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${jwt}`, apikey: anonKey },
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

  // Gated HERE and not only in the UI: the button is not the control.
  if (action === 'enable' || action === 'rotate') {
    if (!(await isPro(url, svc, userId))) {
      fail(res, 402, 'Calendar sync is part of the Semester pass.', { code: 'payment_required' })
      return
    }
  }

  // The RPCs run as the CALLER, so `auth.uid()` inside them is the only thing
  // deciding whose feed this is — the user id read above is never passed in.
  const asUser = {
    apikey: anonKey,
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  }
  const rpc = async (fn: string, args: object = {}) => {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: asUser,
      body: JSON.stringify(args),
    })
    return { ok: r.ok, status: r.status, body: await r.text() }
  }

  if (action === 'enable' || action === 'rotate') {
    const out = await rpc(action === 'enable' ? 'enable_calendar_feed' : 'rotate_calendar_feed')
    if (!out.ok) {
      fail(res, ...unavailable(out.body, 'Could not set up the feed.'))
      return
    }
    const token = JSON.parse(out.body) as string
    res.status(200).json({ token, url: feedUrl(token) })
    return
  }

  if (action === 'disable') {
    const out = await rpc('disable_calendar_feed')
    if (!out.ok) {
      fail(res, ...unavailable(out.body, 'Could not turn the feed off.'))
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  if (action === 'layers') {
    const b = body as { assessments?: boolean; tasks?: boolean }
    const out = await rpc('set_calendar_feed_layers', {
      p_assessments: typeof b.assessments === 'boolean' ? b.assessments : null,
      p_tasks: typeof b.tasks === 'boolean' ? b.tasks : null,
    })
    if (!out.ok) {
      fail(res, ...unavailable(out.body, 'Could not save that.'))
      return
    }
    res.status(200).json({ ok: true })
    return
  }

  fail(res, 400, 'Unknown action.', { hint: 'enable | rotate | disable | layers' })
}

/* ── Plumbing ─────────────────────────────────────────────────────────────── */

interface AssignmentRow {
  id: string
  course_id: string | null
  title: string
  date: string | null
  type: string | null
  weight: number | null
  done: boolean | null
  custom_course_code: string | null
}
interface CourseRow {
  id: string
  code: string | null
}
interface TodoRow {
  id: string
  title: string
  due: string | null
  note: string | null
  done: boolean | null
  source: string | null
}

function notFound(res: any) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.status(404).send('No such calendar.')
}

export function feedUrl(token: string): string {
  return `${SITE}/api/calendar/${token}.ics`
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const r = await fetch(url, { headers })
    if (!r.ok) return null
    return (await r.json()) as T
  } catch {
    return null
  }
}

/** Pro is `plan_status = 'pro'` OR a live `pro_until`, the same two conditions
 *  the client reads, so the server and the UI cannot disagree about it. */
async function isPro(url: string, svc: Record<string, string>, userId: string): Promise<boolean> {
  const rows = await getJson<ProfileRow[]>(
    `${url}/rest/v1/user_profile?user_id=eq.${userId}&select=plan_status,pro_until&limit=1`,
    svc,
  )
  const p = rows?.[0]
  if (!p) return false
  if (p.plan_status === 'pro') return true
  return !!p.pro_until && new Date(p.pro_until).getTime() > Date.now()
}

/**
 * Record that somebody fetched it.
 *
 * Fire-and-forget, and deliberately AFTER the response: this exists to answer
 * "is Google actually reading my link", which is the one question the student
 * cannot check themselves, and it must never be able to fail the feed.
 */
async function touch(url: string, svc: Record<string, string>, token: string, req: any) {
  try {
    const agent = String(req.headers?.['user-agent'] ?? '').slice(0, 120)
    await fetch(`${url}/rest/v1/rpc/ct_touch_calendar_feed`, {
      method: 'POST',
      headers: svc,
      body: JSON.stringify({ p_token: token, p_agent: agent }),
    })
  } catch {
    /* a missed counter is not worth a failed calendar */
  }
}

/**
 * A missing migration must not read as a broken product.
 *
 * Between shipping this code and running `db/calendar_feed.sql` the RPCs do
 * not exist, and PostgREST answers PGRST202 / Postgres answers 42883. Passing
 * that straight through puts "Could not find the function
 * public.enable_calendar_feed" in front of a student, which is our problem
 * described in our vocabulary. They get a sentence about waiting; the file to
 * run stays in `hint`, where whoever deploys will look.
 */
function unavailable(
  body: string,
  fallback: string,
): [number, string, { code?: 'not_configured'; hint?: string }] {
  const pg = readPgError(body)
  if (pg && /(PGRST202|42883|could not find the function|does not exist)/i.test(body)) {
    return [
      503,
      'Calendar sync is still being switched on. Try again in a few minutes.',
      { code: 'not_configured', hint: 'The server is missing db/calendar_feed.sql.' },
    ]
  }
  return [500, pg ?? fallback, {}]
}

function readPgError(body: string): string | null {
  try {
    const j = JSON.parse(body) as { message?: string; hint?: string }
    return j.message ?? null
  } catch {
    return null
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}
