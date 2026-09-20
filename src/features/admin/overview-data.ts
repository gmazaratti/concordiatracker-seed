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
  /** Subscriptions that STARTED that day, from Stripe's event log. */
  subscribers: number
  /**
   * Trials whose end date is that day — the day each one converts or lapses.
   *
   * NOT trials started: nothing records when a trial began (user_profile has
   * trial_end and no start), and inferring one by subtracting an assumed
   * length would be wrong for every account from when the trial was 7 days.
   */
  trials: number
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
 *
 * THE SAME RULE APPLIES INSIDE A SERIES POINT, and for the same reason. A
 * deployment whose SQL migration has not been run yet returns rows without
 * the newest columns, and the chart's scale is Math.max(1, ...values) — which
 * is NaN the moment one value is undefined, so picking that metric draws
 * nothing and the only way out is to pick a different one. A column the
 * database has not got is a flat zero line, which is the truth.
 */
const point = (p: Partial<SeriesPoint>): SeriesPoint => {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return {
    day: p.day ?? '',
    signups: n(p.signups),
    visitors: n(p.visitors),
    active: n(p.active),
    page_views: n(p.page_views),
    subscribers: n(p.subscribers),
    trials: n(p.trials),
  }
}

function shape(j: Partial<Overview>, days: number): Overview {
  return {
    days: typeof j.days === 'number' ? j.days : days,
    generatedAt: j.generatedAt ?? new Date().toISOString(),
    timezone: j.timezone ?? 'UTC',
    stripe: j.stripe ?? { error: 'No figures came back from Stripe.' },
    series: Array.isArray(j.series) ? j.series.map(point) : [],
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
 * a screenshot next to a number that is not theirs. These are made up.
 *
 * THE ADDRESSES USE REAL CONSUMER DOMAINS, by request: example.com is
 * unmistakably fake and made every screenshot read as a mock-up. The trade,
 * written down because it is a real one: a plausible gmail address can belong
 * to somebody. Most forms below carry digits, which is both how people
 * actually write addresses and what makes an exact collision unlikely —
 * but none of these were checked against a real inbox and none should be
 * mailed.
 *
 * The shape is kept honest: subscriptions are rarer than signups, which are
 * rarer than parses, and the timestamps march backwards at plausible gaps, so
 * the list reads like a product rather than a wall of one event type.
 */
const DOMAINS = [
  'gmail.com', 'gmail.com', 'gmail.com', 'hotmail.com',
  'outlook.com', 'icloud.com', 'yahoo.ca', 'live.ca',
]

/**
 * An address in the shapes people really use — first.last, flast, a name with
 * a number on the end — rather than one template repeated fifteen times,
 * which is what makes a list of fake users look generated.
 *
 * KEYED ON THE NAME, NOT THE ROW. The feed reuses a name every few rows, and
 * picking the form by row index gave the same person two different addresses
 * two lines apart — the kind of detail that makes a reader stop trusting the
 * whole screenshot. A name now always produces the same address.
 *
 * Accents are stripped the way a signup form would: Léa Gagnon types
 * lea.gagnon, not léa.gagnon.
 */
function fakeEmail(name: string): string {
  const plain = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '')
  const [first, last] = name.split(' ')
  const f = plain(first)
  const l = plain(last ?? '')
  // A plain character sum. It only has to be stable and well spread across a
  // list of fifteen names, so anything stronger would be ceremony.
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  // FIVE forms, against eight domains: both counts are coprime with the
  // feed's stride, so every combination gets used instead of the same two
  // repeating down the page.
  const forms = [
    `${f}.${l}`,
    `${f}${l}${60 + (h % 39)}`,
    `${f[0]}${l}`,
    `${f}${l}`,
    `${f}.${l}${h % 10}`,
  ]
  return `${forms[h % forms.length]}@${DOMAINS[h % DOMAINS.length]}`
}

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
        who: fakeEmail(name),
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
        who: fakeEmail(name),
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

/**
 * A DAY IN THE DEMO PRODUCT, at the top of its curve. Everything else is
 * derived from these six numbers, so they are the only knobs.
 *
 * They are absolute rather than a multiple of the real series, which is the
 * change that made the rest of the page add up. Scaling live data meant the
 * cards claimed eleven thousand users while the chart underneath showed six
 * signups a day — five years of accumulation, on one screen, contradicting
 * itself. Real numbers are near zero right now, so multiplying them only ever
 * magnified noise.
 *
 * The funnel is baked into the ORDER of these: page views over visitors over
 * active over signups over subscribers, and trials below signups. Anything
 * that breaks that ordering reads as fabricated at a glance, which defeats
 * the point of a screenshot.
 */
const DEMO_PEAK = {
  page_views: 2600,
  visitors: 780,
  active: 330,
  signups: 38,
  subscribers: 5,
  trials: 3,
}

/** A day's signups as a share of the whole base — sets the headline count. */
const DEMO_SIGNUP_SHARE = 0.0034

export function inflate(o: Overview): Overview {
  const curve = (i: number, n: number) => 0.45 + 1.25 * (i / Math.max(1, n - 1)) ** 1.6
  const wobble = (i: number) => 1 + 0.18 * Math.sin(i * 1.7) + 0.09 * Math.cos(i * 0.6)

  // The real series is used for its DAYS and nothing else, so the x-axis still
  // says today and the range picker still means something.
  const series = o.series.map((p, i, all) => {
    const f = curve(i, all.length) * wobble(i)
    const at = (peak: number) => Math.max(0, Math.round(peak * f))
    return {
      day: p.day,
      signups: at(DEMO_PEAK.signups),
      visitors: at(DEMO_PEAK.visitors),
      active: at(DEMO_PEAK.active),
      page_views: at(DEMO_PEAK.page_views),
      subscribers: at(DEMO_PEAK.subscribers),
      trials: at(DEMO_PEAK.trials),
    }
  })

  // THE USER BASE IS DERIVED FROM THE DAILY RATE, NOT FROM THE WINDOW'S TOTAL.
  // Summing the series made the headline count triple when the chart went from
  // 30 days to 90 — the same product in three sizes, depending on a dropdown.
  const perDay = series.reduce((n, p) => n + p.signups, 0) / Math.max(1, series.length)
  const users = Math.round(perDay / DEMO_SIGNUP_SHARE)
  const paying = Math.round(users * 0.11)

  // THE BLEND OF THE TWO REAL PRICES, not a round $5 × everyone: the semester
  // pass is $15 every four months, which is $3.75 a month, so a book of
  // subscribers on both plans cannot come out to a whole number of dollars.
  // Roughly seven monthly for every three on the pass.
  const blendedCents = Math.round(0.7 * 500 + 0.3 * 375)
  const mrr = paying * blendedCents

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
      // DERIVED FROM THE CHART, not from the user count. A flat 42% of the
      // base came to more distinct people than seven days of the line above
      // could possibly hold — a number contradicted by the graph beside it.
      // Roughly 2.2 visits each over a week is the assumption.
      active_7d: Math.round(series.slice(-7).reduce((n, p) => n + p.active, 0) / 2.2),
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
