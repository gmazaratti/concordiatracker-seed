import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarPlus,
  Eye,
  Lock,
  Sparkles,
  Trophy,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { metricsTotals, type ManagedEvent } from '@/data/teacher'
import { CATEGORY_META, CATEGORY_ORDER } from '@/features/community/category'
import { Stat, Metric } from './OrgStat'
import { cn } from '@/lib/cn'

type Tab = 'reach' | 'events'

const TABS: { id: Tab; label: string }[] = [
  { id: 'reach', label: 'Reach' },
  { id: 'events', label: 'By event' },
]

const pct = (part: number, whole: number): string =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'

/** `/organizer/insights` — the interactive reach picture: totals, the
 * views → follows → saves funnel with conversion rates, category performance,
 * and a ranked per-event breakdown with save rates. Aggregate-only, stated
 * plainly; bars are single-hue (magnitude), identity is carried by labels. */
export function OrganizerInsights() {
  const { currentOrg } = useTeacher()
  const [tab, setTab] = useState<Tab>('reach')
  if (!currentOrg) return <Navigate to="/organizer" replace />

  const { events, followers } = currentOrg

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <header className="mb-4">
        <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Insights</h1>
        <p className="text-[13px] text-subtle">How your events reach students.</p>
      </header>

      <div className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'relative px-3.5 py-2.5 text-[13.5px] font-medium transition-colors duration-150',
              tab === t.id ? 'text-fg' : 'text-subtle hover:text-fg',
            )}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" aria-hidden />
            )}
          </button>
        ))}
      </div>

      {tab === 'reach' ? <ReachTab followers={followers} events={events} /> : <ByEvent events={events} />}
    </div>
  )
}

function ReachTab({ followers, events }: { followers: number; events: ManagedEvent[] }) {
  const totals = metricsTotals(events)
  const noData = totals.views === 0 && totals.follows === 0 && totals.calendarAdds === 0

  return (
    <div className="flex flex-col gap-7">
      <div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={UserPlus} label="Followers" value={followers} primary />
          <Stat icon={CalendarPlus} label="Calendar adds" value={totals.calendarAdds} primary />
          <Stat icon={Sparkles} label="Event follows" value={totals.follows} primary />
          <Stat icon={Eye} label="Total views" value={totals.views} />
        </div>
        <p className="mt-2.5 flex items-start gap-1.5 text-[12px] text-subtle">
          <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
          Aggregate numbers only — you never see which students viewed, followed, or added an event.
        </p>
      </div>

      {noData ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-surface/40 px-4 py-8 text-center text-[13px] text-subtle">
          Numbers start counting as students open, follow, and save your events — post one and check
          back.
        </p>
      ) : (
        <>
          <Funnel totals={totals} />
          <CategorySplit events={events} />
          <BestEvent events={events} />
        </>
      )}
    </div>
  )
}

/** Views → follows → calendar adds as a funnel: three bars on one scale (views
 * = full width) with the stage-to-stage conversion rates called out. */
function Funnel({ totals }: { totals: { views: number; follows: number; calendarAdds: number } }) {
  const stages: { icon: LucideIcon; label: string; value: number; hint: string }[] = [
    { icon: Eye, label: 'Opened an event', value: totals.views, hint: 'views' },
    { icon: Sparkles, label: 'Followed one', value: totals.follows, hint: 'event follows' },
    { icon: CalendarPlus, label: 'Saved it to their calendar', value: totals.calendarAdds, hint: 'calendar adds' },
  ]
  const max = Math.max(1, totals.views)

  return (
    <section>
      <h2 className="mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        The funnel — from a view to a saved seat
      </h2>
      <p className="mb-3 text-[12.5px] text-subtle">
        Of everyone who opens your events, {pct(totals.follows, totals.views)} follow one and{' '}
        <strong className="font-medium text-fg">{pct(totals.calendarAdds, totals.views)} save it
        to their calendar</strong> — that save rate is your strongest signal.
      </p>
      <div className="overflow-hidden rounded-xl border border-border">
        {stages.map((s, i) => {
          const Icon = s.icon
          const width = Math.max(2, Math.round((s.value / max) * 100))
          const prev = stages[i - 1]
          return (
            <div key={s.label} className={cn('px-4 py-3', i > 0 && 'border-t border-border/70')}>
              {i > 0 && prev && (
                <p className="mb-1.5 flex items-center gap-1 text-[11px] text-subtle">
                  <ArrowRight size={11} aria-hidden />
                  {pct(s.value, prev.value)} of the stage above
                </p>
              )}
              <div className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
                  <Icon size={14} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-fg">{s.label}</span>
                    <span className="shrink-0 text-[13px] font-semibold text-fg tabular-nums">
                      {s.value.toLocaleString()}
                      <span className="ml-1 font-normal text-subtle">{s.hint}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Calendar adds per event category — magnitude bars in one hue; each row is
 * identified by its category icon + name (identity never rides on color). */
function CategorySplit({ events }: { events: ManagedEvent[] }) {
  const byCat = CATEGORY_ORDER.map((cat) => {
    const evs = events.filter((e) => e.category === cat)
    const adds = evs.reduce((s, e) => s + e.metrics.calendarAdds, 0)
    const views = evs.reduce((s, e) => s + e.metrics.views, 0)
    return { cat, count: evs.length, adds, views }
  }).filter((c) => c.count > 0)
  if (byCat.length < 2) return null
  const max = Math.max(1, ...byCat.map((c) => c.adds))

  return (
    <section>
      <h2 className="mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        What lands, by category
      </h2>
      <p className="mb-3 text-[12.5px] text-subtle">
        Calendar adds per event category — where your audience actually commits.
      </p>
      <ul className="overflow-hidden rounded-xl border border-border">
        {byCat
          .sort((a, b) => b.adds - a.adds)
          .map(({ cat, count, adds, views }, i) => {
            const meta = CATEGORY_META[cat]
            const Icon = meta.icon
            return (
              <li key={cat} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-border/70')}>
                <span
                  className="grid size-7 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${meta.hex}1f`, color: meta.hex }}
                  aria-hidden
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-fg">
                      {meta.label}
                      <span className="ml-1.5 text-[11.5px] font-normal text-subtle">
                        {count} event{count === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12.5px] text-muted tabular-nums">
                      <strong className="font-semibold text-fg">{adds.toLocaleString()}</strong> adds
                      <span className="ml-1.5 text-subtle">· {pct(adds, views)} save rate</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${Math.max(2, Math.round((adds / max) * 100))}%` }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
      </ul>
    </section>
  )
}

/** The single best performer by calendar adds — a callout, not a chart. */
function BestEvent({ events }: { events: ManagedEvent[] }) {
  const best = [...events].sort((a, b) => b.metrics.calendarAdds - a.metrics.calendarAdds)[0]
  if (!best || best.metrics.calendarAdds === 0) return null
  const meta = CATEGORY_META[best.category]
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-contrast">
        <Trophy size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-fg">
          Your best performer: {best.title.trim() || 'Untitled event'}
        </p>
        <p className="text-[12px] text-muted">
          {best.metrics.calendarAdds.toLocaleString()} calendar adds ·{' '}
          {pct(best.metrics.calendarAdds, best.metrics.views)} of viewers saved it · {meta.label}.
          More like this one.
        </p>
      </div>
      <Link
        to={`/organizer/event/${best.id}`}
        className="shrink-0 text-[12.5px] font-medium text-accent hover:underline"
      >
        Open event
      </Link>
    </section>
  )
}

/** Ranked per-event breakdown — adds bar on one scale + a save-rate figure. */
function ByEvent({ events }: { events: ManagedEvent[] }) {
  const ranked = [...events].sort((a, b) => b.metrics.calendarAdds - a.metrics.calendarAdds)
  const maxAdds = Math.max(1, ...events.map((e) => e.metrics.calendarAdds))

  if (events.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border/70 bg-surface/40 px-4 py-8 text-center text-[13px] text-subtle">
        Post an event to start seeing how it performs.
      </p>
    )
  }

  return (
    <div>
      <p className="mb-3 text-[12.5px] text-subtle">
        Ranked by calendar adds; the save rate is the share of viewers who committed.
      </p>
      <ul className="overflow-hidden rounded-xl border border-border">
        {ranked.map((e, i) => {
          const cat = CATEGORY_META[e.category]
          const Icon = cat.icon
          const title = e.title.trim() || 'Untitled event'
          const width = Math.max(2, Math.round((e.metrics.calendarAdds / maxAdds) * 100))
          return (
            <li key={e.id} className={i > 0 ? 'border-t border-border/70' : undefined}>
              <Link
                to={`/organizer/event/${e.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3 transition-colors duration-150 hover:bg-surface-2/50"
              >
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${cat.hex}1f`, color: cat.hex }}
                  aria-hidden
                >
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13.5px] font-medium text-fg">{title}</span>
                    <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted tabular-nums">
                      {pct(e.metrics.calendarAdds, e.metrics.views)} save rate
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${width}%` }} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[12px] text-muted tabular-nums">
                  <Metric icon={CalendarPlus} value={e.metrics.calendarAdds} title="Calendar adds" />
                  <Metric icon={UserPlus} value={e.metrics.follows} title="Follows" />
                  <Metric icon={Eye} value={e.metrics.views} title="Views" muted />
                </div>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
