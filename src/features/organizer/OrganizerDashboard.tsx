import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Circle,
  Plus,
  Sparkles,
  UserPlus,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { metricsTotals, type ManagedEvent } from '@/data/teacher'
import { formatDueDateTime, startOfToday } from '@/lib/date'
import { StatusChip } from '@/layouts/TeacherLayout'
import { Button } from '@/components/ui/Button'
import { OrgLogo } from '@/features/community/OrgLogo'
import { CATEGORY_META } from '@/features/community/category'
import { Stat } from './OrgStat'
import { OrgEventsTab } from './OrgEventsTab'
import { OrgInsightsTab } from './OrgInsightsTab'
import { cn } from '@/lib/cn'

type Tab = 'overview' | 'events' | 'insights'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'Events' },
  { id: 'insights', label: 'Insights' },
]

/** The organizer's home — a tabbed dashboard (Overview · Events · Insights),
 * matching the tabbed feel of the main app. */
export function OrganizerDashboard() {
  const { currentOrg, createEvent } = useTeacher()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  if (!currentOrg) return null

  const pending = currentOrg.status === 'pending'

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
        <Button size="sm" onClick={newEvent}>
          <Plus size={15} aria-hidden />
          New event
        </Button>
      </header>

      {pending && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
          <strong className="font-semibold">Pending approval.</strong> You can set up your profile and
          draft events now — they go live in Community once an admin approves your org.
        </div>
      )}

      <div className="mt-5 flex gap-1 border-b border-border">
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

      <div className="mt-5">
        {tab === 'overview' && <OverviewTab onNew={newEvent} onSeeEvents={() => setTab('events')} />}
        {tab === 'events' && (
          <OrgEventsTab events={currentOrg.events} orgColor={currentOrg.org.color} onNew={newEvent} />
        )}
        {tab === 'insights' && (
          <OrgInsightsTab followers={currentOrg.followers} events={currentOrg.events} />
        )}
      </div>
    </div>
  )
}

function OverviewTab({ onNew, onSeeEvents }: { onNew: () => void; onSeeEvents: () => void }) {
  const { currentOrg } = useTeacher()
  if (!currentOrg) return null
  const { org, events, members, followers } = currentOrg
  const totals = metricsTotals(events)
  const now = startOfToday().getTime()
  const upcoming = [...events]
    .filter((e) => new Date(e.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 3)

  const steps: SetupStep[] = [
    { done: !!org.bio?.trim(), label: 'Complete your profile', hint: 'Add a bio, logo, and links', to: '/organizer/profile' },
    { done: events.length > 0, label: 'Post your first event', hint: 'Reach students in Community', onClick: onNew },
    { done: members.length > 1, label: 'Invite your team', hint: 'Share the dashboard with co-organizers', to: '/organizer/team' },
  ]
  const setupDone = steps.every((s) => s.done)

  return (
    <div className="flex flex-col gap-6">
      {!setupDone && <SetupChecklist steps={steps} />}

      <div>
        <h3 className="mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">At a glance</h3>
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={UserPlus} label="Followers" value={followers} primary />
          <Stat icon={CalendarPlus} label="Calendar adds" value={totals.calendarAdds} primary />
          <Stat icon={Sparkles} label="Event follows" value={totals.follows} primary />
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Upcoming</h3>
          {events.length > 0 && (
            <button
              type="button"
              onClick={onSeeEvents}
              className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-accent hover:underline"
            >
              View all events <ChevronRight size={14} aria-hidden />
            </button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <button
            type="button"
            onClick={onNew}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface/40 px-4 py-8 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent"
          >
            <Plus size={16} aria-hidden />
            {events.length === 0 ? 'Create your first event' : 'No upcoming events — post one'}
          </button>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.map((e) => (
              <UpcomingRow key={e.id} event={e} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

interface SetupStep {
  done: boolean
  label: string
  hint: string
  to?: string
  onClick?: () => void
}

function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  const cls =
    'flex items-center gap-2.5 border-t border-border px-4 py-2.5 transition-colors duration-150'
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          <Sparkles size={16} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-fg">Get set up</p>
          <p className="text-[12px] text-subtle">
            {doneCount} of {steps.length} done
          </p>
        </div>
      </div>
      <ul>
        {steps.map((s) => {
          const inner = (
            <>
              {s.done ? (
                <CheckCircle2 size={18} className="shrink-0 text-accent" aria-hidden />
              ) : (
                <Circle size={18} className="shrink-0 text-border-strong" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'block text-[13px] font-medium',
                    s.done ? 'text-subtle line-through' : 'text-fg',
                  )}
                >
                  {s.label}
                </span>
                {!s.done && <span className="block truncate text-[11px] text-subtle">{s.hint}</span>}
              </span>
              {!s.done && <ChevronRight size={15} className="shrink-0 text-subtle" aria-hidden />}
            </>
          )
          return (
            <li key={s.label}>
              {s.done ? (
                <div className={cls}>{inner}</div>
              ) : s.to ? (
                <Link to={s.to} className={cn(cls, 'hover:bg-surface-2/50')}>
                  {inner}
                </Link>
              ) : (
                <button type="button" onClick={s.onClick} className={cn(cls, 'w-full text-left hover:bg-surface-2/50')}>
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function UpcomingRow({ event }: { event: ManagedEvent }) {
  const cat = CATEGORY_META[event.category]
  const Icon = cat.icon
  const title = event.title.trim() || 'Untitled event'
  return (
    <li>
      <Link
        to={`/organizer/event/${event.id}`}
        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg"
          style={{ backgroundColor: `${cat.hex}1f`, color: cat.hex }}
          aria-hidden
        >
          <Icon size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium text-fg">{title}</span>
          <p className="truncate text-[12px] text-subtle">{formatDueDateTime(event.start)}</p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
      </Link>
    </li>
  )
}
