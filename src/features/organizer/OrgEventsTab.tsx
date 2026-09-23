import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Eye, LayoutGrid, Plus, Rows3, UserPlus } from 'lucide-react'
import type { ManagedEvent } from '@/data/teacher'
import { formatDueDateTime, startOfToday } from '@/lib/date'
import { CATEGORY_META } from '@/features/community/category'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { Metric } from './OrgStat'
import { FallbackImg } from '@/components/ui/FallbackImg'

type View = 'grid' | 'list'

/** The Events tab — a grid/list toggle over the org's managed events, split into
 * Upcoming and Past sections. Every event opens its editor. */
export function OrgEventsTab({
  events,
  orgColor,
  onNew,
  canManage = true,
}: {
  events: ManagedEvent[]
  orgColor: string
  onNew: () => void
  /** False → view-only (no create button; per-member permission). */
  canManage?: boolean
}) {
  const [view, setView] = useState<View>('grid')
  const now = startOfToday().getTime()
  const sorted = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )
  // Drafts are their own shelf: private to the team, and not "upcoming" in
  // any sense a student would recognise until somebody publishes them.
  const drafts = sorted.filter((e) => e.isDraft)
  const live = sorted.filter((e) => !e.isDraft)
  const upcoming = live.filter((e) => new Date(e.start).getTime() >= now)
  const past = live.filter((e) => new Date(e.start).getTime() < now).reverse()

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <ViewToggle view={view} onChange={setView} />
        {canManage && (
          <Button size="sm" onClick={onNew}>
            <Plus size={15} aria-hidden />
            New event
          </Button>
        )}
      </div>

      {events.length === 0 ? (
        canManage ? (
          <button
            type="button"
            onClick={onNew}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface/40 px-4 py-12 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent"
          >
            <Plus size={18} aria-hidden />
            Create your first event
          </button>
        ) : (
          <p className="rounded-xl border border-dashed border-border/70 bg-surface/40 px-4 py-10 text-center text-[13px] text-subtle">
            No events yet.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {drafts.length > 0 && (
            <Section title="Drafts" count={drafts.length} events={drafts} view={view} orgColor={orgColor} />
          )}
          <Section title="Upcoming" count={upcoming.length} events={upcoming} view={view} orgColor={orgColor} emptyLabel="No upcoming events: post one to reach students." />
          {past.length > 0 && (
            <Section title="Past" count={past.length} events={past} view={view} orgColor={orgColor} />
          )}
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  count,
  events,
  view,
  orgColor,
  emptyLabel,
}: {
  title: string
  count: number
  events: ManagedEvent[]
  view: View
  orgColor: string
  emptyLabel?: string
}) {
  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {title} · {count}
      </h3>
      {events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/70 bg-surface/40 px-4 py-6 text-center text-[13px] text-subtle">
          {emptyLabel ?? 'Nothing here yet.'}
        </p>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} orgColor={orgColor} past={title === 'Past'} />
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <EventRow key={e.id} event={e} past={title === 'Past'} />
          ))}
        </ul>
      )}
    </section>
  )
}

function eventLocation(e: ManagedEvent): string {
  if (e.mode === 'online') return 'Online'
  return e.location || 'Location TBA'
}

function EventCard({ event, orgColor, past }: { event: ManagedEvent; orgColor: string; past: boolean }) {
  const cat = CATEGORY_META[event.category]
  const Icon = cat.icon
  const title = event.title.trim() || 'Untitled event'
  return (
    <Link
      to={`/organizer/event/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors duration-150 hover:border-border-strong"
    >
      <div className="relative h-24 w-full overflow-hidden" style={{ backgroundColor: orgColor }} aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-black/35" />
        <span className="absolute top-2.5 left-2.5 grid size-7 place-items-center rounded-md bg-white/20 text-white backdrop-blur-sm">
          <Icon size={15} />
        </span>
        {(past || event.isDraft) && (
          <span className="absolute top-2.5 right-2.5 z-10 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {event.isDraft ? 'Draft' : 'Past'}
          </span>
        )}
        {event.image && (
          <FallbackImg
            src={event.image}
            className="absolute inset-0 size-full object-cover"
          />
        )}
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <span className="line-clamp-1 text-[14px] font-medium text-fg">{title}</span>
        <p className="mt-0.5 line-clamp-1 text-[12px] text-subtle">{formatDueDateTime(event.start)}</p>
        <p className="line-clamp-1 text-[12px] text-subtle">{eventLocation(event)}</p>
        <div className="mt-3 flex items-center gap-3 border-t border-border/60 pt-2.5 text-[12px] text-muted tabular-nums">
          <Metric icon={CalendarPlus} value={event.metrics.calendarAdds} title="Calendar adds" />
          <Metric icon={UserPlus} value={event.metrics.follows} title="Follows" />
          <Metric icon={Eye} value={event.metrics.views} title="Views" muted />
        </div>
      </div>
    </Link>
  )
}

function EventRow({ event, past }: { event: ManagedEvent; past: boolean }) {
  const cat = CATEGORY_META[event.category]
  const Icon = cat.icon
  const title = event.title.trim() || 'Untitled event'
  return (
    <li>
      <Link
        to={`/organizer/event/${event.id}`}
        className="group flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${cat.hex}1f`, color: cat.hex }}
          aria-hidden
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium text-fg">{title}</span>
            {(past || event.isDraft) && (
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                  event.isDraft ? 'bg-warning/15 text-warning' : 'bg-surface-2 text-subtle',
                )}
              >
                {event.isDraft ? 'Draft' : 'Past'}
              </span>
            )}
          </div>
          <p className="truncate text-[12px] text-subtle">
            {formatDueDateTime(event.start)} · {eventLocation(event)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[12px] text-muted tabular-nums">
          <Metric icon={CalendarPlus} value={event.metrics.calendarAdds} title="Calendar adds" />
          <Metric icon={UserPlus} value={event.metrics.follows} title="Follows" />
          <Metric icon={Eye} value={event.metrics.views} title="Views" muted />
        </div>
      </Link>
    </li>
  )
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  const opts: { value: View; label: string; icon: typeof LayoutGrid }[] = [
    { value: 'grid', label: 'Grid', icon: LayoutGrid },
    { value: 'list', label: 'List', icon: Rows3 },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Event layout"
      className="flex gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {opts.map((o) => {
        const Icon = o.icon
        const active = view === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${o.label} view`}
            title={`${o.label} view`}
            onClick={() => onChange(o.value)}
            className={cn(
              'grid size-7 place-items-center rounded-md transition-colors duration-150',
              active ? 'bg-surface-2 text-fg' : 'text-subtle hover:text-fg',
            )}
          >
            <Icon size={15} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
