import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Bug,
  CreditCard,
  FileText,
  LifeBuoy,
  Loader2,
  Shapes,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { AreaChart, Sparkline } from '../AreaChart'
import { Panel, RefreshButton } from '../admin-ui'
import {
  ACTIVITY_FILTERS,
  DEFAULT_ACTIVITY_KINDS,
  arr,
  compact,
  delta,
  inflate,
  loadOverview,
  money,
  total,
  type ActivityKind,
  type Overview,
  type SeriesPoint,
} from '../overview-data'

type Metric = 'visitors' | 'signups' | 'active' | 'page_views'
const METRICS: { id: Metric; label: string }[] = [
  { id: 'visitors', label: 'Visitors' },
  { id: 'signups', label: 'Signups' },
  { id: 'active', label: 'Active users' },
  { id: 'page_views', label: 'Page views' },
]
const RANGES = [7, 30, 90] as const

/**
 * The business overview.
 *
 * ONE METRIC ON THE CHART AT A TIME. The layout this is modelled on runs two
 * lines over one axis; revenue in dollars and signups in people on a shared
 * y-scale is the classic dual-axis mistake, so the metric is a toggle and the
 * period-over-period comparison is a percentage on the card instead.
 *
 * Every figure says where it came from. The money is Stripe's answer, read
 * live; the counts are ours; ARR is labelled an estimate because it is one
 * month times twelve, not a year of observed revenue.
 */
export function OverviewTab() {
  const [days, setDays] = useState<number>(30)
  const [metric, setMetric] = useState<Metric>('visitors')
  const [demo, setDemo] = useState(false)
  const [kinds, setKinds] = useState<Set<ActivityKind>>(() => new Set(DEFAULT_ACTIVITY_KINDS))
  const [raw, setRaw] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  // `busy` is derived from the request the effect is CURRENTLY serving rather
  // than set at the top of it: a synchronous setState in an effect body is
  // the cascading-render lint, and a counter compare says the same thing.
  const [servedKey, setServedKey] = useState('')
  const key = `${days}:${reloads}`
  const busy = servedKey !== key

  useEffect(() => {
    let alive = true
    void loadOverview(days)
      .then((o) => {
        if (!alive) return
        setRaw(o)
        setError('')
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => alive && setServedKey(key))
    return () => {
      alive = false
    }
  }, [days, reloads, key])

  if (error && !raw) {
    return (
      <p className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] text-fg">
        <AlertTriangle size={14} className="mt-px shrink-0 text-danger" aria-hidden />
        <span>{error}</span>
      </p>
    )
  }
  if (!raw) {
    return (
      <p className="flex items-center gap-2 py-12 text-[13px] text-subtle">
        <Loader2 size={15} className="animate-spin" aria-hidden />
        Reading Stripe and the database
      </p>
    )
  }

  const o = demo ? inflate(raw) : raw
  const s = o.stripe
  const c = o.counts
  const cur = s.currency ?? 'cad'
  const revenue = Object.entries(s.revenueTotal ?? {})
  const chart = o.series.map((p: SeriesPoint) => ({ day: p.day, value: p[metric] }))
  const metricLabel = METRICS.find((m) => m.id === metric)?.label ?? ''
  const shownActivity = o.activity.filter((a) => kinds.has(a.kind))

  return (
    <div className="space-y-4">
      {/* ── Header: range, the discreet toggle, refresh ─────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto font-display text-[17px] font-semibold text-fg">Overview</h2>

        {/* The inflate button. Unlabelled and unrelated-looking, as asked —
            it only changes what is drawn and writes nothing anywhere. */}
        <button
          type="button"
          onClick={() => setDemo((d) => !d)}
          aria-pressed={demo}
          aria-label={demo ? 'Show real figures' : 'Show demo figures'}
          title={demo ? 'Back to real figures' : 'Demo figures'}
          className={cn(
            'grid size-7 place-items-center rounded-md transition-colors duration-200',
            demo ? 'bg-accent-soft text-accent' : 'text-subtle/50 hover:text-subtle',
          )}
        >
          <Shapes size={14} aria-hidden />
        </button>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                days === r ? 'bg-accent-soft text-accent' : 'text-muted hover:text-fg',
              )}
            >
              {r}d
            </button>
          ))}
        </div>
        <RefreshButton onClick={reload} busy={busy} />
      </div>

      {/* The banner that used to sit here is gone by request: it appeared in
          the screenshots the mode exists to take. The lit toggle above is now
          the only cue you are in it — deliberate, but worth knowing, because
          the queues below are inflated too and a reload is what clears it. */}

      {/* ── The money ───────────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <BigCard
          label="Monthly recurring"
          value={s.mrr != null ? money(s.mrr, cur) : '—'}
          sub={s.mrr != null ? `${money(arr(s.mrr), cur)} a year at this rate` : 'No Stripe data'}
          accent
        />
        <BigCard
          label="Revenue to date"
          value={revenue.length ? revenue.map(([k, v]) => money(v, k)).join(' · ') : money(0, cur)}
          sub="Settled charges, net of refunds"
        />
        <BigCard
          label="Paying customers"
          value={s.payingCustomers != null ? String(s.payingCustomers) : '—'}
          sub={
            s.trialing
              ? `${s.trialing} on a trial, not counted until they convert`
              : 'Charged at least once'
          }
        />
      </div>

      {s.error && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-[12.5px] text-fg">
          <AlertTriangle size={14} className="mt-px shrink-0 text-warning" aria-hidden />
          <span>Stripe did not answer: {s.error}. The counts below are still ours.</span>
        </p>
      )}

      {/* ── The chart + activity ────────────────────────────────────────── */}
      {/* minmax(0, …), not a bare fr.
          A bare `1.6fr` is `minmax(auto, 1.6fr)`, and that `auto` minimum is
          the content's min-content width — so the activity list, full of long
          unbroken reason text, refused to shrink and squeezed the chart into
          a 90px strip. The explicit 0 floor is what lets the fractions hold. */}
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Panel title={metricLabel}>
          <div className="px-3.5 pt-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-display text-[26px] leading-none font-semibold text-fg tabular-nums">
                  {compact(total(o.series, metric))}
                </p>
                <p className="mt-1 text-[11.5px] text-subtle">over {o.days} days</p>
              </div>
              <Delta value={delta(o.series, metric)} />
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {METRICS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMetric(m.id)}
                  className={cn(
                    'rounded-md px-2 py-1 text-[11.5px] font-medium transition-colors duration-150',
                    metric === m.id
                      ? 'bg-accent-soft text-accent'
                      : 'text-subtle hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="px-3.5 pt-2 pb-3">
            {/* Keyed on the metric and range so the line redraws rather than
                morphing between two unrelated scales. */}
            <AreaChart
              key={`${metric}-${o.days}-${demo}`}
              points={chart}
              label={metricLabel}
              format={(n) => compact(Math.round(n))}
              height={196}
            />
          </div>
        </Panel>

        <Panel title="Recent activity" sub={`${shownActivity.length} of ${o.activity.length}`}>
          <div className="flex flex-wrap gap-1 border-b border-border px-3.5 py-2">
            {ACTIVITY_FILTERS.map((f) => {
              const on = kinds.has(f.id)
              const n = o.activity.filter((r) => r.kind === f.id).length
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setKinds((prev) => {
                      const next = new Set(prev)
                      if (next.has(f.id)) next.delete(f.id)
                      else next.add(f.id)
                      return next
                    })
                  }
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-colors duration-150',
                    on ? 'bg-accent-soft text-accent' : 'text-subtle hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  {f.label}
                  {/* The count shows even when the filter is off, so turning
                      one on is never a guess about whether anything is there. */}
                  <span className="text-[10.5px] tabular-nums opacity-70">{n}</span>
                </button>
              )
            })}
          </div>
          <ul className="max-h-[340px] min-h-[220px] divide-y divide-border overflow-y-auto">
            {shownActivity.length === 0 && (
              <li className="px-3.5 py-6 text-center text-[12.5px] text-subtle">
                {o.activity.length === 0 ? 'Nothing yet.' : 'Nothing in the filters you have on.'}
              </li>
            )}
            {shownActivity.map((a, i) => (
              <li key={`${a.at}-${i}`} className="flex items-start gap-2.5 px-3.5 py-2.5">
                <ActivityIcon kind={a.kind} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-fg">{a.label}</p>
                  <p className="truncate text-[11.5px] text-subtle">
                    {a.who}
                    {a.detail ? ` · ${a.detail}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-subtle">{ago(a.at)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {/* ── The small trends ────────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniCard
          icon={UserPlus}
          label="Signups"
          value={String(c.signups_7d ?? 0)}
          sub="last 7 days"
          points={o.series.map((p) => ({ day: p.day, value: p.signups }))}
          d={delta(o.series, 'signups')}
        />
        <MiniCard
          icon={Users}
          label="Active users"
          value={String(c.active_7d ?? 0)}
          sub="last 7 days"
          points={o.series.map((p) => ({ day: p.day, value: p.active }))}
          d={delta(o.series, 'active')}
        />
        {/* Page views, not courses. The sparkline has to plot the thing the
            card names -- a courses total over a page-views curve is a chart
            of one number and a label of another. Courses live in the sub. */}
        <MiniCard
          icon={BookOpen}
          label="Page views"
          value={compact(total(o.series.slice(-7), 'page_views'))}
          sub={`${compact(c.courses ?? 0)} courses across ${c.users_total ?? 0} accounts`}
          points={o.series.map((p) => ({ day: p.day, value: p.page_views }))}
          d={delta(o.series, 'page_views')}
        />
      </div>

      <NeedsAttention o={o} />


      <Notes o={o} demo={demo} />
    </div>
  )
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

function BigCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string
  value: string
  sub: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors duration-300',
        accent ? 'border-accent/35 bg-accent-soft/25' : 'border-border bg-surface',
      )}
    >
      <p className="text-[11px] tracking-wide text-subtle uppercase">{label}</p>
      {/* The number animates its own value change so switching to demo reads
          as the same card moving, not as a different card appearing. */}
      <p
        key={value}
        className="ct-count mt-1.5 font-display text-[25px] leading-none font-semibold text-fg tabular-nums"
      >
        {value}
      </p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-subtle">{sub}</p>
    </div>
  )
}

function MiniCard({
  icon: Icon,
  label,
  value,
  sub,
  points,
  d,
}: {
  icon: typeof Users
  label: string
  value: string
  sub: string
  points: { day: string; value: number }[]
  d: number | null
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-start gap-2.5 px-3.5 pt-3">
        <Icon size={14} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11.5px] text-subtle">{label}</p>
          <p key={value} className="ct-count font-display text-[20px] leading-tight font-semibold text-fg tabular-nums">
            {value}
          </p>
          <p className="text-[11px] text-subtle">{sub}</p>
        </div>
        <Delta value={d} small />
      </div>
      <Sparkline points={points} />
    </div>
  )
}

function Delta({ value, small = false }: { value: number | null; small?: boolean }) {
  if (value === null) {
    // Not "0%". Nothing to compare against is a different statement.
    return <span className={cn('text-subtle', small ? 'text-[10.5px]' : 'text-[11.5px]')}>—</span>
  }
  const up = value >= 0
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular-nums',
        small ? 'text-[10.5px]' : 'text-[11.5px]',
        up ? 'bg-success/12 text-success' : 'bg-danger/12 text-danger',
      )}
      title="Against the previous window of the same length"
    >
      {up ? <ArrowUpRight size={11} aria-hidden /> : <ArrowDownRight size={11} aria-hidden />}
      {Math.abs(value)}%
    </span>
  )
}

function ActivityIcon({ kind }: { kind: string }) {
  const map: Record<string, { icon: typeof Users; tone: string }> = {
    signup: { icon: UserPlus, tone: 'text-success' },
    subscription: { icon: CreditCard, tone: 'text-accent' },
    parse: { icon: FileText, tone: 'text-info' },
    ticket: { icon: LifeBuoy, tone: 'text-warning' },
    bug: { icon: Bug, tone: 'text-danger' },
    admin: { icon: Sparkles, tone: 'text-subtle' },
  }
  const { icon: Icon, tone } = map[kind] ?? { icon: Users, tone: 'text-subtle' }
  return (
    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-surface-2">
      <Icon size={12} className={tone} aria-hidden />
    </span>
  )
}

/**
 * Work waiting on someone.
 *
 * These were the whole of the old Overview — a grid of raw counts. They are
 * real and worth seeing, but they answer "what should I do today", not "how
 * are we doing", so they sit under the growth figures rather than instead of
 * them. Deliberately NOT inflated in demo mode: fake support tickets send
 * someone looking for tickets that are not there.
 */
function NeedsAttention({ o }: { o: Overview }) {
  const items = [
    { label: 'Open tickets', n: o.counts.open_tickets ?? 0, to: 'tickets' },
    { label: 'Applications', n: o.ops.pending_applications ?? 0, to: 'applications' },
    { label: 'Orgs to approve', n: o.ops.pending_orgs ?? 0, to: 'portals' },
    { label: 'Bug reports', n: o.ops.open_bugs ?? 0, to: 'bugs' },
  ].filter((i) => i.n > 0)

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface/60 px-3.5 py-2.5 text-[12px] text-subtle">
        Nothing waiting on you: no open tickets, applications, approvals or bug reports.
      </p>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface/60 px-3.5 py-2.5">
      <span className="text-[11px] tracking-wide text-subtle uppercase">Needs attention</span>
      {items.map((i) => (
        <a
          key={i.label}
          href={`?tab=${i.to}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-1 text-[12px] text-fg transition-colors hover:bg-accent-soft hover:text-accent"
        >
          {i.label}
          <span className="font-semibold tabular-nums">{i.n}</span>
        </a>
      ))}
    </div>
  )
}

/**
 * What these numbers cannot tell you.
 *
 * Every dashboard is read as more certain than it is. Saying where the data
 * thins out costs three lines and stops a number being trusted past what it
 * can carry.
 */
function Notes({ o, demo }: { o: Overview; demo: boolean }) {
  const notes: string[] = []
  if (demo) notes.push('Demo mode is on: every figure above is inflated and none of it is real.')
  if (o.stripe.mode === 'test') {
    notes.push('Stripe is in TEST mode on this deployment, so the money is not real money.')
  }
  if (o.counts.events_since) {
    notes.push(
      `Visitor tracking only goes back to ${new Date(o.counts.events_since).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}; anything before that is missing, not zero.`,
    )
  }
  if (o.counts.internal) {
    notes.push(
      `${o.counts.internal} internal accounts and ${o.counts.comped ?? 0} comped accounts are excluded from every count and from revenue.`,
    )
  }
  notes.push(`Days are UTC calendar days, so "today" ends at 00:00 UTC.`)
  notes.push(...(o.stripe.notes ?? []))

  return (
    <details className="rounded-lg border border-border bg-surface/60 px-3.5 py-2.5">
      <summary className="cursor-pointer text-[11.5px] font-medium text-subtle">
        How solid are these numbers?
      </summary>
      <ul className="mt-2 space-y-1.5">
        {notes.map((n) => (
          <li key={n} className="flex gap-2 text-[11.5px] leading-relaxed text-muted">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-subtle" aria-hidden />
            {n}
          </li>
        ))}
      </ul>
    </details>
  )
}

function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  return d < 30 ? `${d}d` : `${Math.round(d / 30)}mo`
}
