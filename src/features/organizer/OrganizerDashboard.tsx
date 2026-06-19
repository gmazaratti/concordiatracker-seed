import { Link, useNavigate } from 'react-router-dom'
import { CalendarPlus, Eye, Lock, Plus, Sparkles, UserPlus } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { metricsTotals, type ManagedEvent } from '@/data/teacher'
import { formatDueDateTime, startOfToday } from '@/lib/date'
import { StatusChip } from '@/layouts/TeacherLayout'
import { Button } from '@/components/ui/Button'
import { OrgLogo } from '@/features/community/OrgLogo'
import { CATEGORY_META } from '@/features/community/category'
import { cn } from '@/lib/cn'

/** The organizer's home once signed in — org reach totals (intent metrics lead),
 * the managed-event list with per-event aggregate metrics, and create/edit. */
export function OrganizerDashboard() {
  const { currentOrg, createEvent } = useTeacher()
  const navigate = useNavigate()
  if (!currentOrg) return null

  const pending = currentOrg.status === 'pending'
  const totals = metricsTotals(currentOrg.events)
  const now = startOfToday().getTime()
  const events = [...currentOrg.events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  )

  function newEvent() {
    const id = createEvent()
    navigate(`/organizer/event/${id}`)
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <header className="flex flex-wrap items-center gap-3">
        <OrgLogo org={currentOrg.org} className="size-11" rounded="rounded-xl" textClass="text-[15px]" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">
            {currentOrg.org.name}
          </h1>
          <p className="text-[13px] text-subtle">
            {currentOrg.org.handle} · manage your events and reach.
          </p>
        </div>
        <StatusChip status={currentOrg.status} />
      </header>

      {pending && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
          <strong className="font-semibold">Pending approval.</strong> You can set up your profile and
          draft events now — they go live in Community once an admin approves your org.
        </div>
      )}

      {/* Org reach — intent (adds, follows) leads; views are secondary. */}
      <h2 className="mt-6 mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Your reach
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon={UserPlus} label="Followers" value={currentOrg.followers} primary />
        <Stat icon={CalendarPlus} label="Calendar adds" value={totals.calendarAdds} primary />
        <Stat icon={Sparkles} label="Event follows" value={totals.follows} primary />
        <Stat icon={Eye} label="Total views" value={totals.views} />
      </div>
      <p className="mt-2.5 flex items-start gap-1.5 text-[12px] text-subtle">
        <Lock size={13} className="mt-0.5 shrink-0" aria-hidden />
        Aggregate numbers only — you never see which students viewed, followed, or added an event.
      </p>

      {/* Managed events */}
      <div className="mt-6 mb-3 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
          Your events · {events.length}
        </h2>
        <Button size="sm" onClick={newEvent}>
          <Plus size={15} aria-hidden />
          New event
        </Button>
      </div>

      {events.length === 0 ? (
        <button
          type="button"
          onClick={newEvent}
          className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface/40 px-4 py-10 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent"
        >
          <Plus size={18} aria-hidden />
          Create your first event
        </button>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((e) => (
            <EventRow key={e.id} event={e} past={new Date(e.start).getTime() < now} />
          ))}
        </ul>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  primary,
}: {
  icon: typeof Eye
  label: string
  value: number
  primary?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5',
        primary ? 'border-border bg-surface' : 'border-border/60 bg-surface/50',
      )}
    >
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <Icon size={14} className={primary ? 'text-accent' : 'text-subtle'} aria-hidden />
        {label}
      </div>
      <p className="mt-1 font-display text-[22px] font-semibold text-fg tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
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
            {past && (
              <span className="shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-subtle">
                Past
              </span>
            )}
          </div>
          <p className="truncate text-[12px] text-subtle">
            {formatDueDateTime(event.start)} · {event.location || 'Location TBA'}
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

function Metric({
  icon: Icon,
  value,
  title,
  muted,
}: {
  icon: typeof Eye
  value: number
  title: string
  muted?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <Icon size={13} className={muted ? 'text-subtle' : 'text-accent'} aria-hidden />
      {value.toLocaleString()}
    </span>
  )
}
