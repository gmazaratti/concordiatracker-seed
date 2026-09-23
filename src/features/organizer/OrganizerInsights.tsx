import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CalendarDays,
  CalendarPlus,
  Eye,
  Images,
  Lock,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { metricsTotals, type ManagedEvent } from '@/data/teacher'
import { CATEGORY_META, CATEGORY_ORDER } from '@/features/community/category'
import { AreaChart } from '@/features/admin/AreaChart'
import { Panel } from '@/features/admin/admin-ui'
import { ymd } from '@/features/calendar/calendar'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/cn'

/**
 * `/organizer/insights` — the club's reach, laid out like the admin overview.
 *
 * WHY IT LOOKS LIKE THAT PAGE. The admin dashboard had already solved this
 * layout — a row of headline numbers, one large chart with a metric switcher,
 * supporting panels beside it — and reusing `Panel` and `AreaChart` means the
 * two cannot drift into two different products. This page used to be a strip
 * of tabs over stacked lists, which is a filing cabinet, not a picture.
 *
 * ── THE HARD PART, AND IT IS NOT THE LAYOUT ─────────────────────────────────
 * PER-EVENT REACH IS NOT RECORDED FOR A REAL CLUB. There is no `metrics`
 * column on `events`; `eventRowToManaged` hands every Supabase-backed event
 * `{views: 0, follows: 0, calendarAdds: 0}`, and only the seeded demo org
 * carries real numbers. So a beautiful chart here would draw a flat zero line
 * for every genuine club — which reads as "nobody looked at your event", not
 * as "we are not measuring this yet". That is the worst kind of wrong: a
 * confident number that is only an absence.
 *
 * So the page leads with what IS true — followers, posts, events, what is
 * still to come, all counted from real rows — and where reach would be it
 * SAYS it is not being measured rather than drawing a zero. The chart and the
 * funnel appear the moment there is anything real to put in them.
 *
 * AGGREGATE ONLY, restated on the page. An organizer never learns WHICH
 * student viewed, followed or saved — the line the whole portal is built on.
 */
type Metric = 'views' | 'calendarAdds' | 'follows'

const METRICS: { id: Metric; label: string }[] = [
  { id: 'views', label: 'Views' },
  { id: 'calendarAdds', label: 'Calendar adds' },
  { id: 'follows', label: 'Event follows' },
]

const compact = (n: number) =>
  n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString()

const rate = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—'

/* A module-level helper, not an expression in the body: `react-hooks/purity`
   refuses a clock read during render, and rightly — two renders a millisecond
   apart would disagree about which events are still to come. */
function countUpcoming(events: ManagedEvent[]): number {
  const now = Date.now()
  return events.filter((e) => new Date(e.start).getTime() >= now).length
}

interface Social {
  followers: number
  posts: number
}

export function OrganizerInsights() {
  const { currentOrg, orgViewerPerms } = useTeacher()
  const [metric, setMetric] = useState<Metric>('views')
  const [social, setSocial] = useState<Social | null>(null)
  const handle = currentOrg?.org.handle ?? ''

  /* THE FOLLOWER COUNT COMES FROM THE DATABASE, not from the provider, which
     hard-codes `followers: 0` for every real org. `org_follows` is select-own,
     so a client query would return 1 or 0 and call it the audience — the
     definer function is the only honest source. */
  useEffect(() => {
    if (!handle) return
    let alive = true
    void supabase.rpc('org_social', { p_handle: handle }).then(({ data }) => {
      if (!alive || !data) return
      const d = data as { followers?: number; posts?: number }
      setSocial({ followers: d.followers ?? 0, posts: d.posts ?? 0 })
    })
    return () => {
      alive = false
    }
  }, [handle])

  if (!currentOrg) return <Navigate to="/organizer" replace />
  if (!orgViewerPerms.view_insights) return <Navigate to="/organizer" replace />

  const { events } = currentOrg
  const totals = metricsTotals(events)
  const hasReach = totals.views + totals.calendarAdds + totals.follows > 0

  // A draft with no title is not something anybody attended.
  const dated = events
    .filter((e) => e.title.trim())
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
  const upcoming = countUpcoming(dated)

  /* `AreaChart` takes an ISO DAY per point, not a timestamp — it builds its
     axis label with `new Date(`${day}T12:00:00Z`)`, so handing it a full
     `…T18:00:00.000Z` start produced three "Invalid Date" ticks. `ymd` rather
     than `slice(0, 10)`: an 11pm event is on the day it is LOCALLY on, which
     is the same rule Radar's week buckets had to be fixed to. */
  const points = dated.map((e) => ({
    day: ymd(new Date(e.start)),
    value: e.metrics?.[metric] ?? 0,
  }))

  const best = dated
    .slice()
    .sort((a, b) => (b.metrics?.views ?? 0) - (a.metrics?.views ?? 0))
    .slice(0, 6)

  const byCategory = CATEGORY_ORDER.map((c) => ({
    id: c,
    label: CATEGORY_META[c].label,
    events: dated.filter((e) => e.category === c).length,
    views: dated
      .filter((e) => e.category === c)
      .reduce((n, e) => n + (e.metrics?.views ?? 0), 0),
  })).filter((r) => r.events > 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Insights</h1>
        <p className="text-[13px] text-subtle">
          How {currentOrg.org.name} reaches students. Counts only — never who.
        </p>
      </header>

      {/* WHAT IS ACTUALLY KNOWN LEADS. Every one of these four is a row count
          from a real table, so they are the same number tomorrow whatever we
          do or do not start measuring. */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Headline label="Followers" value={social?.followers ?? null} icon={Users} accent />
        <Headline label="Posts" value={social?.posts ?? null} icon={Images} />
        <Headline label="Events published" value={dated.length} icon={CalendarDays} />
        <Headline label="Still to come" value={upcoming} icon={CalendarPlus} accent />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {hasReach ? (
          <Panel title="Reach by event" sub="Each point is one event, on its own date">
            <div className="px-3.5 pt-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="font-display text-[26px] leading-none font-semibold text-fg tabular-nums">
                    {compact(totals[metric])}
                  </p>
                  <p className="mt-1 text-[11.5px] text-subtle">
                    across {dated.length} event{dated.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {METRICS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMetric(m.id)}
                      aria-pressed={metric === m.id}
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-150',
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
            </div>

            {points.length >= 2 ? (
              <AreaChart
                points={points}
                format={(n) => compact(n)}
                label={METRICS.find((m) => m.id === metric)?.label ?? ''}
                height={190}
                className="mt-2"
              />
            ) : (
              <p className="px-4 py-10 text-center text-[12.5px] text-subtle">
                {/* Two points is the minimum a line can honestly be drawn from. */}
                Post a couple of events and this becomes a shape you can read.
              </p>
            )}

            <p className="border-t border-border px-4 py-2.5 text-[11px] leading-snug text-subtle">
              Plotted per event, not per day — we do not record when each view happened, so a
              daily line would be invented.
            </p>
          </Panel>
        ) : (
          <NotMeasuredYet events={dated.length} />
        )}

        <div className="flex flex-col gap-4">
          {hasReach && (
            <Panel title="From seeing it to coming" sub="Where interest drops off">
              <div className="flex flex-col gap-2.5 p-4">
                <FunnelRow label="Saw it" value={totals.views} of={totals.views} />
                <FunnelRow
                  label="Followed the event"
                  value={totals.follows}
                  of={totals.views}
                  note={rate(totals.follows, totals.views)}
                />
                <FunnelRow
                  label="Added to their calendar"
                  value={totals.calendarAdds}
                  of={totals.views}
                  note={rate(totals.calendarAdds, totals.views)}
                />
              </div>
            </Panel>
          )}

          <Panel title="What you've published" sub="By month, from your own events">
            <PublishedByMonth events={dated} />
          </Panel>

          <Panel title="Privacy" sub="What this page can never show">
            <p className="flex items-start gap-2 p-4 text-[12px] leading-relaxed text-subtle">
              <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
              Totals only. Nobody in this portal — including us — can see which students
              viewed, followed or saved anything you posted.
            </p>
          </Panel>
        </div>
      </div>

      {hasReach && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Best events" sub="By views">
            <ul className="flex flex-col gap-2.5 p-4">
              {best.map((e) => (
                <EventBar key={e.id} event={e} max={best[0]?.metrics?.views ?? 1} />
              ))}
            </ul>
          </Panel>

          <Panel title="By category" sub="Where your reach comes from">
            {byCategory.length === 0 ? (
              <p className="px-4 py-8 text-center text-[12.5px] text-subtle">Nothing posted yet.</p>
            ) : (
              <ul className="flex flex-col gap-2.5 p-4">
                {byCategory.map((c) => (
                  <li key={c.id}>
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0 truncate text-fg">{c.label}</span>
                      <span className="shrink-0 text-subtle tabular-nums">
                        {c.events} event{c.events === 1 ? '' : 's'} · {compact(c.views)}
                      </span>
                    </div>
                    <Bar
                      value={c.views}
                      max={Math.max(1, ...byCategory.map((x) => x.views))}
                      color={CATEGORY_META[c.id].hex}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}

/**
 * The panel that stands where a zero chart would have.
 *
 * It names the three numbers that are missing so the page is still an answer
 * to "how did we do", and it says WHY rather than implying the club did badly.
 */
function NotMeasuredYet({ events }: { events: number }) {
  return (
    <Panel title="Reach" sub="Not being measured yet">
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Eye, label: 'Views' },
            { icon: CalendarPlus, label: 'Calendar adds' },
            { icon: UserPlus, label: 'Event follows' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="rounded-lg border border-dashed border-border bg-surface-2/40 px-3 py-3 text-center"
            >
              <Icon size={14} className="mx-auto text-subtle" aria-hidden />
              <p className="mt-1.5 font-display text-[18px] leading-none font-semibold text-subtle">
                —
              </p>
              <p className="mt-1 text-[11px] text-subtle">{label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3.5 text-[12.5px] leading-relaxed text-muted">
          We do not record who opens an event yet, so these would be zero for every club — and a
          zero here reads as “nobody came”, which is not something we know.
          {events > 0
            ? ` Your ${events} published event${events === 1 ? '' : 's'} ${events === 1 ? 'is' : 'are'} live in Community in the meantime.`
            : ' Publish an event and it goes live in Community in the meantime.'}
        </p>
        <p className="mt-2 text-[11.5px] leading-snug text-subtle">
          When it arrives it will be counts only — never which students.
        </p>
      </div>
    </Panel>
  )
}

/** Events per month, from their own dates. Real data, no estimation. */
function PublishedByMonth({ events }: { events: ManagedEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[12.5px] text-subtle">Nothing published yet.</p>
    )
  }
  const buckets = new Map<string, number>()
  for (const e of events) {
    const d = new Date(e.start)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  const rows = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8)
  const max = Math.max(1, ...rows.map(([, n]) => n))
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' })
  return (
    <ul className="flex flex-col gap-2.5 p-4">
      {rows.map(([key, n]) => (
        <li key={key}>
          <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
            <span className="text-fg">{fmt.format(new Date(`${key}-01T12:00:00`))}</span>
            <span className="text-subtle tabular-nums">
              {n} event{n === 1 ? '' : 's'}
            </span>
          </div>
          <Bar value={n} max={max} />
        </li>
      ))}
    </ul>
  )
}

function Headline({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  /** `null` while it is still being fetched — never rendered as a zero. */
  value: number | null
  icon: LucideIcon
  accent?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <p className="flex items-center gap-1.5 text-[11.5px] text-subtle">
        <Icon size={13} className={accent ? 'text-accent' : ''} aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-display text-[22px] leading-none font-semibold text-fg tabular-nums">
        {value === null ? <span className="text-subtle">—</span> : compact(value)}
      </p>
    </div>
  )
}

/** A single-hue bar: magnitude, not identity. Identity is the label. */
function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
      <div
        className="h-full rounded-full"
        style={{ width: `${w}%`, backgroundColor: color ?? 'var(--ct-accent)' }}
      />
    </div>
  )
}

function FunnelRow({
  label,
  value,
  of,
  note,
}: {
  label: string
  value: number
  of: number
  note?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="min-w-0 truncate text-fg">{label}</span>
        <span className="shrink-0 text-subtle tabular-nums">
          {compact(value)}
          {note && <span className="ml-1.5 text-[11px]">{note}</span>}
        </span>
      </div>
      <Bar value={value} max={of} />
    </div>
  )
}

function EventBar({ event, max }: { event: ManagedEvent; max: number }) {
  const v = event.metrics?.views ?? 0
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="min-w-0 truncate text-fg">{event.title}</span>
        <span className="shrink-0 text-subtle tabular-nums">
          {compact(v)}
          <span className="ml-1.5 text-[11px]">
            {rate(event.metrics?.calendarAdds ?? 0, v)} saved
          </span>
        </span>
      </div>
      <Bar value={v} max={max} />
    </li>
  )
}
