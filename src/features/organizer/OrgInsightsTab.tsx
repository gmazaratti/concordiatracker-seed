import { CalendarPlus, Eye, Lock, Sparkles, UserPlus } from 'lucide-react'
import { metricsTotals, type ManagedEvent } from '@/data/teacher'
import { CATEGORY_META } from '@/features/community/category'
import { Stat, Metric } from './OrgStat'

/** The Insights tab — the full reach picture: org-level totals up top, then a
 * per-event breakdown ranked by calendar adds. Aggregate-only (privacy note). */
export function OrgInsightsTab({
  followers,
  events,
}: {
  followers: number
  events: ManagedEvent[]
}) {
  const totals = metricsTotals(events)
  const ranked = [...events].sort((a, b) => b.metrics.calendarAdds - a.metrics.calendarAdds)
  const maxAdds = Math.max(1, ...events.map((e) => e.metrics.calendarAdds))

  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">Your reach</h3>
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

      <h3 className="mt-7 mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        By event
      </h3>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-surface/40 px-4 py-6 text-center text-[13px] text-subtle">
          Post an event to start seeing how it performs.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-border">
          {ranked.map((e, i) => {
            const cat = CATEGORY_META[e.category]
            const Icon = cat.icon
            const title = e.title.trim() || 'Untitled event'
            const pct = Math.round((e.metrics.calendarAdds / maxAdds) * 100)
            return (
              <li
                key={e.id}
                className={i > 0 ? 'border-t border-border' : undefined}
              >
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
                    {/* Calendar-adds bar — the intent signal that leads. */}
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${pct}%` }}
                      />
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
      )}
    </div>
  )
}
