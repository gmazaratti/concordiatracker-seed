/**
 * /api/v1/owner/* — how the business is doing, for a dashboard or an agent.
 *
 * THE RULES THIS ENDPOINT KEEPS, because a number without them is a number
 * you cannot act on:
 *
 *   · A PAYING CUSTOMER has been charged more than $0 and the charge settled.
 *     A trial is not a customer, a comped account is not a customer, and an
 *     internal account is neither. Each is reported on its own line so the
 *     headline figure can never quietly absorb one of them.
 *   · MRR comes only from subscriptions that have actually been charged.
 *   · Every response carries `notes[]` — anything that makes the figures less
 *     than complete (Stripe paging, test mode, a missing key) says so in the
 *     payload rather than in a comment nobody reads.
 *   · Every timestamp is ISO-8601 in UTC. No local dates, ever: a dashboard in
 *     another timezone silently shifting a day is the classic silent wrong.
 *
 * AND THE ONE IT KEEPS HARDEST: no identities. See ct_owner_users_raw().
 */
import { rpc, table, iso } from './_v1-auth.js'
import { stripeRollup } from './_stripe-admin.js'

interface Json {
  [k: string]: unknown
}

/** Stripe, minus everything that names a person. */
async function money(): Promise<{ money: Json; notes: string[] }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      money: { configured: false },
      notes: ['Stripe is not configured on this deployment, so no revenue figures are included.'],
    }
  }
  try {
    const r = await stripeRollup()
    return {
      money: {
        configured: true,
        mode: r.mode,
        currency: r.currency,
        paying_customers: r.payingCustomers,
        trialing: r.trialing,
        active_subscriptions: r.activeSubscriptions,
        cancelling: r.cancelling,
        mrr_cents: r.mrr,
        // An ESTIMATE, and named one: a month multiplied by twelve, not a year
        // of observed revenue.
        arr_cents_estimated: r.mrr * 12,
        revenue_total_cents: r.revenueTotal,
      },
      notes: r.notes,
    }
  } catch (err) {
    return {
      money: { configured: true, error: true },
      notes: [`Stripe did not answer: ${err instanceof Error ? err.message : 'unknown error'}.`],
    }
  }
}

export async function ownerOverview(): Promise<Json> {
  const counts = (await rpc<Json>('ct_overview_counts_raw', {})) ?? {}
  const { money: m, notes } = await money()
  const all = [...notes]
  if (!Object.keys(counts).length) {
    all.push('The database returned no counts. The api_tokens migration may not have been run.')
  }
  // Said out loud because a dashboard cannot know it otherwise: a chart of
  // "visitors since launch" drawn over three weeks of tracking has a lie in
  // its axis.
  if (counts.events_since) {
    all.push(`Visitor figures only exist from ${iso(counts.events_since as string)} onward.`)
  }
  return {
    generated_at: iso(Date.now()),
    timezone: 'UTC',
    users: {
      total: counts.users_total ?? 0,
      new_24h: counts.signups_24h ?? 0,
      new_7d: counts.signups_7d ?? 0,
      active_7d: counts.active_7d ?? 0,
      comped: counts.comped ?? 0,
      excluded_internal: counts.internal ?? 0,
    },
    engagement: {
      visitors_24h: counts.visitors_24h ?? 0,
      courses_tracked: counts.courses ?? 0,
      tracking_since: counts.events_since ? iso(counts.events_since as string) : null,
    },
    support: { open_tickets: counts.open_tickets ?? 0 },
    money: m,
    notes: all,
  }
}

export async function ownerUsers(): Promise<Json> {
  const u = (await rpc<Json>('ct_owner_users_raw', {})) ?? {}
  return {
    generated_at: iso(Date.now()),
    timezone: 'UTC',
    ...u,
    notes: [
      'Counts only. This endpoint never returns names, emails or user ids — a long-lived token should not be able to export the user table.',
      'Internal and test accounts are excluded from every figure except `excluded_internal`.',
      'Comped accounts are counted as users and are never counted as paying.',
    ],
  }
}

export async function ownerPayments(): Promise<Json> {
  const { money: m, notes } = await money()
  return {
    generated_at: iso(Date.now()),
    timezone: 'UTC',
    ...m,
    notes: [
      ...notes,
      'A paying customer has at least one settled charge over $0. Trials are reported separately and are never counted as paying.',
      'MRR is derived only from subscriptions that have actually been charged.',
      'ARR is an estimate: MRR multiplied by twelve, not a year of observed revenue.',
    ],
  }
}

interface SeriesRow {
  day: string
  signups: number
  visitors: number
  active: number
  page_views: number
}

export async function ownerTimeseries(daysRaw: unknown): Promise<Json> {
  const days = Math.max(1, Math.min(Number(daysRaw) || 30, 365))
  const rows = (await rpc<SeriesRow[]>('ct_daily_series_raw', { p_days: days })) ?? []
  return {
    generated_at: iso(Date.now()),
    timezone: 'UTC',
    days,
    // Gaps are zeros, not missing days — the SQL generates the date series, so
    // a quiet Sunday is a 0 rather than a hole a chart would interpolate over.
    series: rows.map((r) => ({
      day: r.day,
      signups: r.signups,
      visitors: r.visitors,
      active_users: r.active,
      page_views: r.page_views,
    })),
    notes: rows.length
      ? []
      : ['No series returned. The api_tokens migration may not have been run on this project.'],
  }
}

/** A flat health line, useful as an agent's first call. */
export async function ownerPing(): Promise<Json> {
  const rows = await table<{ count: string }>('user_profile?select=count')
  return {
    ok: true,
    generated_at: iso(Date.now()),
    database: rows.length > 0,
    stripe_configured: !!process.env.STRIPE_SECRET_KEY,
  }
}
