import { supabase } from '@/lib/supabase'

/**
 * The Overview page's data, in one request.
 *
 * Money comes from Stripe and everything else from Postgres, merged on the
 * server — three separate fetches would be three snapshots, and a card that
 * disagrees with the chart next to it is worse than a slower page.
 */

export interface SeriesPoint {
  day: string
  signups: number
  visitors: number
  active: number
  page_views: number
}

export interface OverviewCounts {
  users_total: number
  signups_24h: number
  signups_7d: number
  visitors_24h: number
  active_7d: number
  comped: number
  internal: number
  courses: number
  open_tickets: number
  events_since: string | null
}

export type ActivityKind = 'signup' | 'subscription' | 'parse' | 'ticket' | 'bug' | 'admin'

export interface ActivityRow {
  kind: ActivityKind
  label: string
  detail: string | null
  who: string
  at: string
}

/**
 * The filters, and which are on to begin with.
 *
 * THE DEFAULT IS THE THREE THAT MEAN SOMETHING HAPPENED TO THE BUSINESS:
 * someone joined, someone paid, someone got a syllabus in.
 *
 * Tickets and bugs have their own tabs and a Needs-attention strip. ADMIN
 * ACTIONS are your own footprints, and a feed mostly made of things you did
 * yourself says nothing about the product — which is exactly how it looked
 * the moment the audit backfill put four of its own rows at the top.
 */
export const ACTIVITY_FILTERS: { id: ActivityKind; label: string; on: boolean }[] = [
  { id: 'signup', label: 'Signups', on: true },
  { id: 'subscription', label: 'Subscriptions', on: true },
  { id: 'parse', label: 'Outlines scanned', on: true },
  { id: 'ticket', label: 'Tickets', on: false },
  { id: 'bug', label: 'Bugs', on: false },
  { id: 'admin', label: 'Admin actions', on: false },
]

export const DEFAULT_ACTIVITY_KINDS = ACTIVITY_FILTERS.filter((f) => f.on).map((f) => f.id)

export interface StripeSide {
  mode?: 'live' | 'test'
  payingCustomers?: number
  trialing?: number
  activeSubscriptions?: number
  cancelling?: number
  revenueTotal?: Record<string, number>
  mrr?: number
  currency?: string
  payingEmails?: string[]
  notes?: string[]
  error?: string
}

export interface OpsCounts {
  pending_applications?: number
  pending_orgs?: number
  open_bugs?: number
  feature_requests?: number
  survey_responses?: number
}

export interface Overview {
  days: number
  generatedAt: string
  timezone: string
  stripe: StripeSide
  series: SeriesPoint[]
  counts: Partial<OverviewCounts>
  ops: OpsCounts
  activity: ActivityRow[]
}

export async function loadOverview(days: number): Promise<Overview> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in again.')
  const res = await fetch(`/api/admin?action=dashboard&days=${days}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const json = (await res.json().catch(() => ({}))) as Partial<Overview> & { error?: string }
  if (!res.ok) throw new Error(json.error || `Could not load the dashboard (${res.status}).`)
  return shape(json, days)
}

/**
 * Give the payload its full shape before anything reads it.
 *
 * THE DASHBOARD MUST NOT WHITE-SCREEN OVER A MISSING FIELD. It did: when
 * Stripe was unreachable the server answered 200 without a `stripe` key, the
 * component read `.currency` off undefined, and the whole page rendered
 * nothing — so a payments outage looked like a broken admin panel and told
 * you neither thing. A missing section is now an empty section, which the
 * cards already know how to draw, and Stripe's own `error`/`notes` say what
 * went wrong in the place the money would have been.
 *
 * Vite is the other case: `/api/*` is a serverless function, so locally the
 * dev server answers with index.html at 200 and `res.json()` yields {}.
 */
function shape(j: Partial<Overview>, days: number): Overview {
  return {
    days: typeof j.days === 'number' ? j.days : days,
    generatedAt: j.generatedAt ?? new Date().toISOString(),
    timezone: j.timezone ?? 'UTC',
    stripe: j.stripe ?? { error: 'No figures came back from Stripe.' },
    series: Array.isArray(j.series) ? j.series : [],
    counts: j.counts ?? {},
    ops: j.ops ?? {},
    activity: Array.isArray(j.activity) ? j.activity : [],
  }
}

/* ── Derived numbers, kept out of the component ──────────────────────────── */

/** Sum a field over the series. */
export const total = (s: SeriesPoint[], k: keyof SeriesPoint) =>
  s.reduce((n, p) => n + (typeof p[k] === 'number' ? (p[k] as number) : 0), 0)

/**
 * Change against the PREVIOUS window of the same length.
 *
 * Returned as null rather than 0 or Infinity when there is nothing to compare
 * against: "+∞%" and "0%" both read as facts, and neither is one when the
 * first half of the window is empty.
 */
export function delta(s: SeriesPoint[], k: keyof SeriesPoint): number | null {
  if (s.length < 4) return null
  const half = Math.floor(s.length / 2)
  const older = total(s.slice(0, half), k)
  const newer = total(s.slice(half), k)
  if (older === 0) return null
  return Math.round(((newer - older) / older) * 100)
}

/** ARR from MRR. Stated as an ESTIMATE everywhere it appears, because it is
 *  one month multiplied by twelve, not a year of observed revenue. */
export const arr = (mrrCents: number) => mrrCents * 12

/**
 * CENTS ARE SHOWN WHEN THERE ARE CENTS. Rounding to whole dollars turned an
 * MRR of $3.75 into "$4" — a made-up figure on the one card that has to be
 * exactly right, and one you cannot reconcile against Stripe. Whole amounts
 * still render clean ($15, not $15.00), so the common case stays readable.
 */
export function money(cents: number, currency = 'cad'): string {
  const whole = cents % 100 === 0
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(cents / 100)
}

export const compact = (n: number) =>
  new Intl.NumberFormat('en-CA', { notation: 'compact', maximumFractionDigits: 1 }).format(n)

/* ── Demo mode ───────────────────────────────────────────────────────────── */

/**
 * Inflated figures for a screenshot.
 *
 * DERIVED FROM THE REAL SHAPE, not invented from nothing: the same series,
 * scaled and given a steeper curve, so the chart still looks like a product
 * with weekly rhythm rather than a straight line somebody drew. A screenshot
 * of an obviously fake chart is not worth taking.
 *
 * Nothing here is written anywhere. It is a pure transform applied at render
 * and forgotten on reload — there is no state for it to leak into.
 */
/**
 * A busy-looking feed.
 *
 * INVENTED NAMES, NOT REAL ONES SHUFFLED. The obvious cheap version — take
 * the real rows and multiply them — would put an actual customer's email into
 * a screenshot next to a number that is not theirs. These are made up, and
 * the emails are on example.com, which IANA reserves and nobody can own.
 *
 * The shape is kept honest: subscriptions are rarer than signups, which are
 * rarer than parses, and the timestamps march backwards at plausible gaps, so
 * the list reads like a product rather than a wall of one event type.
 */
function fakeActivity(real: ActivityRow[]): ActivityRow[] {
  const who = [
    'Maya Chen', 'Devon Okafor', 'Sofia Ricci', 'Liam Tremblay', 'Priya Nair',
    'Noah Bergeron', 'Amara Diallo', 'Ethan Wu', 'Léa Gagnon', 'Omar Haddad',
    'Jonas Meyer', 'Ines Ferreira', 'Kai Yamamoto', 'Nadia Petrov', 'Theo Lambert',
  ]
  const programs = [
    'Computer Science', 'Finance', 'Psychology', 'Software Engineering',
    'Marketing', 'Political Science', 'Biology', 'No program yet',
  ]
  const rows: ActivityRow[] = []
  let t = Date.now()
  for (let i = 0; i < 24; i++) {
    // Gaps grow as you go back, the way a real feed thins out.
    t -= (6 + i * 11) * 60_000
    const name = who[i % who.length]
    const at = new Date(t).toISOString()
    const roll = i % 6
    if (roll === 0) {
      rows.push({
        kind: 'subscription',
        label: i % 12 === 0 ? 'Started a trial' : 'Payment received',
        detail: i % 12 === 0 ? '3 days left' : '$15.00 — Paid',
        who: `${name.split(' ')[0].toLowerCase()}@example.com`,
        at,
      })
    } else if (roll === 1 || roll === 4) {
      rows.push({
        kind: 'signup',
        label: 'New account',
        detail: programs[i % programs.length],
        who: name,
        at,
      })
    } else if (roll === 2) {
      rows.push({ kind: 'parse', label: 'Syllabus parsed', detail: 'Imported', who: name, at })
    } else if (roll === 3) {
      rows.push({
        kind: 'ticket',
        label: 'Support ticket',
        detail: 'Calendar sync',
        who: `${name.split(' ')[0].toLowerCase()}@example.com`,
        at,
      })
    } else {
      rows.push({ kind: 'parse', label: 'Syllabus parsed', detail: 'Imported', who: name, at })
    }
  }
  // Keep whatever the real feed had at the bottom, so the panel still proves
  // it is reading something when the toggle goes off.
  return [...rows, ...real].slice(0, 40)
}

export function inflate(o: Overview): Overview {
  const scale = 46
  const curve = (i: number, n: number) => 0.45 + 1.25 * (i / Math.max(1, n - 1)) ** 1.6
  const wobble = (i: number) => 1 + 0.18 * Math.sin(i * 1.7) + 0.09 * Math.cos(i * 0.6)

  const series = o.series.map((p, i, all) => {
    const f = scale * curve(i, all.length) * wobble(i)
    return {
      day: p.day,
      signups: Math.max(1, Math.round((p.signups + 1.2) * f * 0.08)),
      visitors: Math.max(3, Math.round((p.visitors + 2) * f * 0.22)),
      active: Math.max(2, Math.round((p.active + 1.5) * f * 0.16)),
      page_views: Math.max(8, Math.round((p.page_views + 6) * f * 0.3)),
    }
  })

  const users = series.reduce((n, p) => n + p.signups, 0) * 9 + 1840
  const paying = Math.round(users * 0.11)
  const mrr = paying * 500 // the $5/month price, so the arithmetic holds up

  return {
    ...o,
    series,
    activity: fakeActivity(o.activity),
    counts: {
      ...o.counts,
      users_total: users,
      signups_24h: series[series.length - 1]?.signups ?? 0,
      signups_7d: series.slice(-7).reduce((n, p) => n + p.signups, 0),
      visitors_24h: series[series.length - 1]?.visitors ?? 0,
      active_7d: Math.round(users * 0.42),
      courses: users * 4,
      // The work queues are inflated too, by request: a screenshot of a busy
      // product with an empty inbox reads as a product nobody writes to.
      //
      // THE TRADE, WRITTEN DOWN: these are the numbers someone acts on, and
      // with the demo banner gone the lit toggle is the only thing saying they
      // are not real. Reloading clears it; nothing here is ever saved.
      open_tickets: 14,
    },
    ops: {
      pending_applications: 6,
      pending_orgs: 3,
      open_bugs: 9,
      feature_requests: o.ops.feature_requests,
      survey_responses: o.ops.survey_responses,
    },
    stripe: {
      ...o.stripe,
      error: undefined,
      payingCustomers: paying,
      trialing: Math.round(paying * 0.14),
      activeSubscriptions: paying,
      cancelling: Math.round(paying * 0.03),
      mrr,
      currency: 'cad',
      revenueTotal: { cad: mrr * 7 + 412_00 },
      notes: [],
    },
  }
}
