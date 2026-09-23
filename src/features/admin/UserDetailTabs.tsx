import { useEffect, useState } from 'react'
import { AlertTriangle, ExternalLink, Loader2, Monitor, Smartphone } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { AdminUser } from './admin-data'
import { EmptyState, Pill, Stat } from './admin-ui'
import {
  day,
  duration,
  money,
  stripeForUser,
  when,
  type AuditEntry,
  type StripeCustomer,
  type UserSummary,
  type UserVisit,
} from './user-detail-data'

/* ── Visits ───────────────────────────────────────────────────────────────── */

export function VisitsTab({
  visits,
  summary,
}: {
  visits: UserVisit[]
  summary: UserSummary | null
}) {
  if (visits.length === 0) {
    return <EmptyState>No visits recorded for this account yet.</EmptyState>
  }
  // Worth saying once, at the top: almost every browser sends no referrer on
  // a direct visit, so "Direct" is the default rather than a finding.
  const direct = visits.filter((v) => v.source === 'Direct').length
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Visits" value={String(summary?.visits ?? visits.length)} />
        {/* ACTIVE time leads; how long tabs sat open is a different fact and
            is named as such. The old "Total time" was the open span, which is
            how a tab left open for a week read as 192 hours on the site. */}
        <Stat label="Active time" value={duration(summary?.active_seconds ?? summary?.total_seconds ?? 0)} />
        <Stat label="Avg active / visit" value={duration(summary?.avg_active_seconds ?? summary?.avg_seconds ?? 0)} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-surface-2/60 text-[11px] tracking-wide text-subtle uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">When</th>
              <th className="px-3 py-2 font-medium">Active</th>
              <th className="px-3 py-2 font-medium">Views</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visits.map((v) => (
              <tr key={v.session_id} className="hover:bg-surface-2/40">
                <td className="px-3 py-2 text-fg">
                  <span className="flex items-center gap-1.5">
                    {v.device === 'mobile' ? (
                      <Smartphone size={12} className="shrink-0 text-subtle" aria-label="Mobile" />
                    ) : (
                      <Monitor size={12} className="shrink-0 text-subtle" aria-label="Desktop" />
                    )}
                    {when(v.started_at)}
                  </span>
                  {/* EVERY PAGE, not just the landing one. The journey was
                      already in site_events and only the first row was read,
                      so every session read "/app" and looked like we track
                      nothing. In first-opened order, because the sequence is
                      the interesting part. */}
                  {v.pages && v.pages.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {v.pages.map((p) => (
                        <span
                          key={p.path}
                          className="inline-flex items-center gap-1 rounded bg-surface-2/70 px-1.5 py-0.5 font-mono text-[10.5px] text-subtle"
                        >
                          {p.path}
                          {p.views > 1 && <span className="text-[9.5px] text-muted">×{p.views}</span>}
                        </span>
                      ))}
                    </span>
                  ) : (
                    v.first_path && (
                      <span className="mt-0.5 block truncate font-mono text-[11px] text-subtle">
                        {v.first_path}
                      </span>
                    )
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted">
                  {duration(v.active_seconds ?? v.seconds)}
                  {v.active_seconds != null && v.seconds > v.active_seconds * 2 && (
                    <span className="block text-[10.5px] text-subtle">tab open {duration(v.seconds)}</span>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted">{v.views ?? v.events}</td>
                <td className="px-3 py-2 text-muted">{v.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11.5px] leading-relaxed text-subtle">
        Active time counts minutes with activity. Before Sep 23, 2026 a visible tab kept reporting
        even when nobody was using it, so older active times are an upper bound. “Tab open” is how
        long the browser tab existed.
      </p>

      {direct > 0 && (
        <p className="text-[11.5px] leading-relaxed text-subtle">
          {direct} of {visits.length} visits show as Direct. Most browsers send no referrer on a
          typed or bookmarked visit, so that is the default rather than a finding — only a tagged
          link or an external click can say otherwise.
        </p>
      )}
    </div>
  )
}

/* ── Subscription ─────────────────────────────────────────────────────────── */

/**
 * Read LIVE from Stripe, not from our columns.
 *
 * Our billing fields are a cache the webhook writes. Showing them here would
 * make this tab agree with the rest of the dashboard by construction, which
 * is worthless: the question it exists to answer is whether that cache is
 * right. So it asks Stripe, and where the two differ it says so.
 */
export function SubscriptionTab({ user }: { user: AdminUser }) {
  const [state, setState] = useState<
    { mode: 'live' | 'test'; customer: StripeCustomer | null } | null
  >(null)
  const [error, setError] = useState('')

  // The no-email case is derived at render rather than set in the effect:
  // a synchronous setState in an effect body is the cascading-render lint.
  const noEmail = !user.email

  useEffect(() => {
    let alive = true
    if (!user.email) return
    void stripeForUser(user.email)
      .then((r) => alive && setState(r))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Stripe failed.'))
    return () => {
      alive = false
    }
  }, [user.email])

  if (noEmail || error) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] text-fg">
        <AlertTriangle size={14} className="mt-px shrink-0 text-danger" aria-hidden />
        <span>{noEmail ? 'This account has no email, so Stripe cannot be looked up.' : error}</span>
      </p>
    )
  }
  if (!state) {
    return (
      <p className="flex items-center gap-2 py-8 text-[13px] text-subtle">
        <Loader2 size={15} className="animate-spin" aria-hidden />
        Asking Stripe
      </p>
    )
  }

  const c = state.customer
  const ourPlan = user.plan_status === 'pro' ? (user.comped ? 'Pro (comped)' : 'Pro') : 'Free'

  if (!c) {
    return (
      <div className="space-y-3">
        <ModeNote mode={state.mode} />
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="text-[13px] font-medium text-fg">Stripe has never seen this email.</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            Our records say <span className="text-fg">{ourPlan}</span>.
            {user.plan_status === 'pro' && !user.comped && (
              <span className="text-warning">
                {' '}
                That is Pro without a payment and without the comped flag — worth explaining or
                marking.
              </span>
            )}
          </p>
        </div>
      </div>
    )
  }

  const sub = c.subscriptions[0]
  return (
    <div className="space-y-3">
      <ModeNote mode={state.mode} />

      {sub ? (
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-[17px] font-semibold text-fg">
              {sub.amount != null ? money(sub.amount, sub.currency ?? 'cad') : '—'}
            </span>
            <span className="text-[12.5px] text-subtle">{sub.interval}</span>
            <Pill tone={statusTone(sub.status)}>{sub.status}</Pill>
            {sub.cancelAtPeriodEnd && <Pill tone="amber">Cancels at period end</Pill>}
          </div>
          <dl className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
            <KV k="Renewing" v={sub.renewing ? 'Yes' : 'No'} />
            <KV k="Subscribed" v={day(sub.startedAt)} />
            <KV k={sub.renewing ? 'Renews' : 'Ends'} v={day(sub.currentPeriodEnd)} />
            {sub.trialEndsAt && <KV k="Trial ends" v={day(sub.trialEndsAt)} />}
          </dl>
          {/* THE STATE THAT LOOKS FINE AND IS NOT: a trial flagged to cancel.
              It reads as "Pro" on every other screen right up until the day it
              silently lapses, and nobody finds out until the student does. */}
          {sub.status === 'trialing' && sub.cancelAtPeriodEnd && (
            <p className="mt-2 rounded-md bg-danger/10 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-fg">
              <strong>This trial will not convert.</strong> It is set to cancel on{' '}
              {day(sub.trialEndsAt)}
              {!sub.hasPaymentMethod && ' and there is no card attached'}, so nothing will be
              charged and they drop to free that day.
              {sub.canceledAt && ` Flagged to cancel ${when(sub.canceledAt)}.`}
            </p>
          )}
          {sub.status === 'trialing' && !sub.cancelAtPeriodEnd && (
            // The distinction that made the paying count look wrong.
            <p className="mt-2 rounded-md bg-info/10 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-fg">
              A card is on file but nothing has been charged yet. They convert on{' '}
              {day(sub.trialEndsAt)} and are not a paying customer until then.
            </p>
          )}
          {sub.status === 'active' && sub.cancelAtPeriodEnd && (
            <p className="mt-2 rounded-md bg-warning/10 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-fg">
              Cancelling. They keep Pro until {day(sub.cancelAt ?? sub.currentPeriodEnd)} and will
              not be billed again.
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-3 text-[12.5px] text-muted">
          A Stripe customer with no subscription. They have a payment method or a past purchase,
          but nothing recurring.
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {Object.entries(c.totalPaid).map(([cur, cents]) => (
          <Stat key={cur} label={`Paid (${cur.toUpperCase()})`} value={money(cents, cur)} />
        ))}
        {Object.keys(c.totalPaid).length === 0 && (
          <Stat label="Paid" value="$0" hint="No settled charge" />
        )}
        <Stat label="Our record" value={ourPlan} />
      </div>

      {c.charges.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Payments
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {c.charges.map((ch) => (
              <li key={ch.id} className="flex items-start gap-3 bg-surface px-3 py-2">
                <span
                  className={cn(
                    'mt-1 size-1.5 shrink-0 rounded-full',
                    ch.paid && !ch.refunded ? 'bg-success' : ch.refunded ? 'bg-info' : 'bg-danger',
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-medium text-fg tabular-nums">
                      {money(ch.amount, ch.currency)}
                    </span>
                    <span className="text-[11.5px] text-subtle">{when(ch.createdAt)}</span>
                  </div>
                  {/* The decline reason, in words. 'Payment failed' is not
                      actionable; 'not enough funds' and 'call your bank' are
                      two different conversations. */}
                  <p
                    className={cn(
                      'mt-0.5 text-[12px] leading-relaxed',
                      ch.paid && !ch.refunded ? 'text-muted' : 'text-warning',
                    )}
                  >
                    {ch.outcome}
                    {ch.declineCode && (
                      <span className="ml-1 font-mono text-[11px] text-subtle">
                        ({ch.declineCode})
                      </span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.invoices.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Invoices
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {c.invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 bg-surface px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">
                  {inv.number ?? inv.id}
                  <span className="ml-2 text-[11.5px] text-subtle">{day(inv.createdAt)}</span>
                </span>
                <span className="shrink-0 text-[12.5px] tabular-nums text-muted">
                  {money(inv.amountPaid || inv.amountDue, inv.currency)}
                </span>
                <Pill tone={inv.status === 'paid' ? 'green' : inv.status === 'open' ? 'amber' : 'neutral'}>
                  {inv.status}
                </Pill>
                {inv.hostedUrl && (
                  <a
                    href={inv.hostedUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open in Stripe"
                    className="shrink-0 text-subtle transition-colors hover:text-fg"
                  >
                    <ExternalLink size={13} aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function statusTone(s: string): string {
  if (s === 'active') return 'green'
  if (s === 'trialing') return 'blue'
  if (s === 'past_due' || s === 'unpaid') return 'red'
  return 'neutral'
}

function ModeNote({ mode }: { mode: 'live' | 'test' }) {
  if (mode === 'live') return null
  return (
    <p className="rounded-md bg-warning/10 px-2.5 py-1.5 text-[11.5px] text-fg">
      This deployment is using Stripe <strong>test</strong> keys, so these are not real payments.
    </p>
  )
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 sm:justify-start">
      <dt className="shrink-0 text-subtle">{k}</dt>
      <dd className="min-w-0 truncate text-fg sm:ml-auto">{v}</dd>
    </div>
  )
}

/* ── History ──────────────────────────────────────────────────────────────── */

export function HistoryTab({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState>
        Nothing has been done to this account by an admin since the log was added.
      </EmptyState>
    )
  }
  return (
    <ol className="space-y-2">
      {entries.map((e) => (
        <li key={e.id} className="rounded-lg border border-border bg-surface p-3">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-[12px] text-accent">{e.action}</span>
            <span className="text-[11.5px] text-subtle">{when(e.created_at)}</span>
          </div>
          <p className="mt-1 text-[13px] leading-relaxed text-fg">{e.reason}</p>
          <p className="mt-1 text-[11.5px] text-subtle">
            by {e.actor_email ?? 'unknown'}
            {e.old_value && e.new_value && <Diff before={e.old_value} after={e.new_value} />}
          </p>
        </li>
      ))}
    </ol>
  )
}

/** Only the fields that actually moved. A dump of both objects buries the one
 *  change in six lines of unchanged values. */
function Diff({
  before,
  after,
}: {
  before: Record<string, unknown>
  after: Record<string, unknown>
}) {
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(
    (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]) && after[k] !== null,
  )
  if (keys.length === 0) return null
  return (
    <>
      {' · '}
      {keys.map((k, i) => (
        <span key={k}>
          {i > 0 && ', '}
          <span className="text-muted">{k}</span> {fmt(before[k])} → <span className="text-fg">{fmt(after[k])}</span>
        </span>
      ))}
    </>
  )
}

const fmt = (v: unknown) => (v === null || v === undefined ? '—' : String(v))
