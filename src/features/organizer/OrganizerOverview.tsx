import { Link, useNavigate } from 'react-router-dom'
import {
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Circle,
  ExternalLink,
  Plus,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { metricsTotals, type ManagedEvent } from '@/data/teacher'
import { orgSlug } from '@/data/community'
import { formatDueDateTime, startOfToday } from '@/lib/date'
import { CATEGORY_META } from '@/features/community/category'
import { Stat } from './OrgStat'
import { cn } from '@/lib/cn'

/** `/organizer` — the comprehensive at-a-glance page: setup checklist (new orgs),
 * reach stats, quick-action cards, and an upcoming preview. Everything else lives
 * on its own sidebar destination (Events / Insights / Profile / Team). */
export function OrganizerOverview() {
  const { currentOrg, createEvent } = useTeacher()
  const navigate = useNavigate()
  if (!currentOrg) return null

  const { org, events, members, followers, status } = currentOrg
  const pending = status === 'pending'
  const totals = metricsTotals(events)
  const now = startOfToday().getTime()
  const upcoming = [...events]
    .filter((e) => new Date(e.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 3)

  function newEvent() {
    const id = createEvent()
    navigate(`/organizer/event/${id}`)
  }

  const steps: SetupStep[] = [
    { done: !!org.bio?.trim(), label: 'Complete your profile', hint: 'Add a bio, logo, and links', to: '/organizer/profile' },
    { done: events.length > 0, label: 'Post your first event', hint: 'Reach students in Community', onClick: newEvent },
    { done: members.length > 1, label: 'Invite your team', hint: 'Share the dashboard with co-organizers', to: '/organizer/team' },
  ]
  const setupDone = steps.every((s) => s.done)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">Overview</h1>
        <p className="text-[13px] text-subtle">How {org.name} is doing, at a glance.</p>
      </header>

      {pending && (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
          <strong className="font-semibold">Pending approval.</strong> You can set up your profile
          and draft events now — they go live in Community once an admin approves your org.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {!setupDone && <SetupChecklist steps={steps} />}

        {/* Reach at a glance → Insights has the full story */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">At a glance</h2>
            <SeeAll to="/organizer/insights" label="Full insights" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={UserPlus} label="Followers" value={followers} primary />
            <Stat icon={CalendarPlus} label="Calendar adds" value={totals.calendarAdds} primary />
            <Stat icon={Sparkles} label="Event follows" value={totals.follows} primary />
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">Quick actions</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <ActionCard icon={Plus} label="New event" sub="Post to Community" onClick={newEvent} accent />
            <ActionCard icon={UserCog} label="Edit profile" sub="Bio, logo, links" to="/organizer/profile" />
            <ActionCard icon={Users} label="Invite team" sub="Share the dashboard" to="/organizer/team" />
            {status === 'approved' ? (
              <ActionCard
                icon={ExternalLink}
                label="Public profile"
                sub="See what students see"
                to={`/app/community/org/${orgSlug(org)}`}
              />
            ) : (
              <ActionCard
                icon={ExternalLink}
                label="Public profile"
                sub="Live after approval"
                disabled
              />
            )}
          </div>
        </section>

        {/* Upcoming preview → Events is the full list */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Upcoming</h2>
            {events.length > 0 && <SeeAll to="/organizer/events" label="All events" />}
          </div>
          {upcoming.length === 0 ? (
            <button
              type="button"
              onClick={newEvent}
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
        </section>
      </div>
    </div>
  )
}

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-0.5 text-[12.5px] font-medium text-accent hover:underline"
    >
      {label} <ChevronRight size={14} aria-hidden />
    </Link>
  )
}

function ActionCard({
  icon: Icon,
  label,
  sub,
  to,
  onClick,
  accent,
  disabled,
}: {
  icon: LucideIcon
  label: string
  sub: string
  to?: string
  onClick?: () => void
  accent?: boolean
  disabled?: boolean
}) {
  const inner = (
    <>
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          accent ? 'bg-accent text-accent-contrast' : 'bg-surface-2 text-muted',
        )}
      >
        <Icon size={17} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-medium text-fg">{label}</span>
        <span className="block truncate text-[11.5px] text-subtle">{sub}</span>
      </span>
    </>
  )
  const cls = cn(
    'flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 text-left transition-colors duration-150',
    disabled ? 'opacity-50' : 'hover:border-border-strong hover:bg-surface-2',
  )
  if (disabled) return <div className={cls}>{inner}</div>
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
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
                <button
                  type="button"
                  onClick={s.onClick}
                  className={cn(cls, 'w-full text-left hover:bg-surface-2/50')}
                >
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
