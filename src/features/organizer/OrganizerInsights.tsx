import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  CalendarPlus,
  Eye,
  Lock,
  Sparkles,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { metricsTotals } from '@/data/teacher'
import { CATEGORY_META } from '@/features/community/category'
import { Stat, Metric } from './OrgStat'
import { cn } from '@/lib/cn'

type Tab = 'reach' | 'events'

const TABS: { id: Tab; label: string }[] = [
  { id: 'reach', label: 'Reach' },
  { id: 'events', label: 'By event' },
]

/** `/organizer/insights` — the full reach picture on its own page, tabbed:
 * Reach (org totals + what each number means) and By event (ranked breakdown).
 * Aggregate-only, stated plainly. */
export function OrganizerInsights() {
  const { currentOrg } = useTeacher()
  const [tab, setTab] = useState<Tab>('reach')
  if (!currentOrg) return <Navigate to="/organizer" replace />

  const { events, followers } = currentOrg
  const totals = metricsTotals(events)

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

      {tab === 'reach' ? (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat icon={UserPlus} label="Followers" value={followers} primary />
            <Stat icon={CalendarPlus} label="Calendar adds" value={totals.calendarAdds} primary />
            <Stat icon={Sparkles} label="Event follows" value={totals.follows} primary />
            <Stat icon={Eye} label="Total views" value={totals.views} />
          </div>
          <p className="mt-2.5 flex items-start gap-1.5 text-[12px] text-subtle">
            <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
            Aggregate numbers only — you never see which students viewed, followed, or added an
            event.
          </p>

          <h2 className="mt-7 mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            What these numbers mean
          </h2>
          <ul className="overflow-hidden rounded-xl border border-border">
            <Explain
              icon={UserPlus}
              label="Followers"
              text="Students following your org — they get a heads-up when you post a new event."
            />
            <Explain
              icon={CalendarPlus}
              label="Calendar adds"
              text="Students who added an event to their personal calendar — the strongest intent signal you have."
            />
            <Explain
              icon={Sparkles}
              label="Event follows"
              text="Students who set a reminder on a specific event."
            />
            <Explain
              icon={Eye}
              label="Views"
              text="How many times an event was opened. Useful for reach, but softer than the intent numbers above."
              last
            />
          </ul>
        </div>
      ) : (
        <ByEvent />
      )}
    </div>
  )
}

function Explain({
  icon: Icon,
  label,
  text,
  last,
}: {
  icon: LucideIcon
  label: string
  text: string
  last?: boolean
}) {
  return (
    <li className={cn('flex items-start gap-3 px-4 py-3', !last && 'border-b border-border')}>
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-accent">
        <Icon size={14} aria-hidden />
      </span>
      <p className="text-[13px] leading-relaxed text-muted">
        <strong className="font-medium text-fg">{label}.</strong> {text}
      </p>
    </li>
  )
}

function ByEvent() {
  const { currentOrg } = useTeacher()
  if (!currentOrg) return null
  const events = currentOrg.events
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
        Ranked by calendar adds — the bar shows each event against your best performer.
      </p>
      <ul className="overflow-hidden rounded-xl border border-border">
        {ranked.map((e, i) => {
          const cat = CATEGORY_META[e.category]
          const Icon = cat.icon
          const title = e.title.trim() || 'Untitled event'
          const pct = Math.round((e.metrics.calendarAdds / maxAdds) * 100)
          return (
            <li key={e.id} className={i > 0 ? 'border-t border-border' : undefined}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-lg"
                  style={{ backgroundColor: `${cat.hex}1f`, color: cat.hex }}
                  aria-hidden
                >
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-fg">{title}</span>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-[12px] text-muted tabular-nums">
                  <Metric icon={CalendarPlus} value={e.metrics.calendarAdds} title="Calendar adds" />
                  <Metric icon={UserPlus} value={e.metrics.follows} title="Follows" />
                  <Metric icon={Eye} value={e.metrics.views} title="Views" muted />
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
