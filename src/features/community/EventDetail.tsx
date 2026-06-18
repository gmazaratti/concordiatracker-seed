import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Bell,
  BellRing,
  CalendarCheck,
  CalendarPlus,
  ChevronRight,
  Clock,
  Mail,
  MapPin,
  Share2,
  UserPlus,
  Video,
  X,
} from 'lucide-react'
import type { CampusEvent } from '@/data/community'
import { isRelevantTo, orgSlug } from '@/data/community'
import { useAppData } from '@/app/providers/app-data'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { formatDueDateTime, startOfToday } from '@/lib/date'
import { cn } from '@/lib/cn'
import { EventMedia } from './EventMedia'
import { CategoryTag } from './EventTile'
import { VerifiedBadge } from './VerifiedBadge'
import { OrgLogo } from './OrgLogo'
import { FollowButton } from './FollowButton'
import { ShareEventModal } from './ShareEventModal'
import { useCommunity } from './useCommunity'

/** Full-screen event detail — an overlay that fills the viewport (closable, not a
 * dropdown). The content (`EventDetailView`) is split out so it could become a
 * linkable route later; the overlay just adds the chrome + a11y. */
export function EventDetail({
  event,
  added,
  onAdd,
  onClose,
  onOpenEvent,
}: {
  event: CampusEvent
  added: boolean
  onAdd: () => void
  onClose: () => void
  onOpenEvent: (id: string) => void
}) {
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)
  const [shareOpen, setShareOpen] = useState(false)

  // Reset scroll when navigating between events (e.g. "more from this host").
  useEffect(() => {
    ref.current?.scrollTo(0, 0)
  }, [event.id, ref])

  return (
    <>
      <div className="ct-animate-fade fixed inset-0 z-50 bg-canvas" onKeyDown={onKeyDown}>
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-label={event.title}
          tabIndex={-1}
          className="h-full overflow-y-auto outline-none"
        >
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-canvas/85 px-4 py-3 backdrop-blur">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft size={16} aria-hidden />
              Events
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <X size={18} aria-hidden />
            </button>
          </header>

          <EventDetailView
            event={event}
            added={added}
            onAdd={onAdd}
            onOpenEvent={onOpenEvent}
            onShare={() => setShareOpen(true)}
          />
        </div>
      </div>
      {shareOpen && <ShareEventModal event={event} onClose={() => setShareOpen(false)} />}
    </>
  )
}

/** The event content, shared by the in-app overlay AND the public `/e/:id` page.
 * `gate` puts it in PUBLIC mode: any interaction (add / remind / follow / contact
 * / view host) calls `gate()` (→ a signup prompt) instead of acting. Sharing and
 * viewing other events stay open to everyone. */
export function EventDetailView({
  event,
  added,
  onAdd,
  onOpenEvent,
  onShare,
  gate,
}: {
  event: CampusEvent
  added: boolean
  onAdd: () => void
  onOpenEvent: (id: string) => void
  onShare: () => void
  gate?: () => void
}) {
  const { user } = useAppData()
  const { moreFromHost } = useCommunity()
  const online = event.mode === 'online'
  const relevant = isRelevantTo(event, user.program, user.school)
  const more = moreFromHost(event, startOfToday())

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 sm:px-6">
      <EventMedia event={event} variant="hero" className="rounded-2xl" />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CategoryTag category={event.category} />
        {relevant && !gate && (
          <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
            For your program
          </span>
        )}
      </div>

      <h1 className="mt-2 font-display text-[clamp(1.6rem,4vw,2rem)] leading-tight font-medium text-fg">
        {event.title}
      </h1>

      <div className="mt-2.5 flex flex-col gap-1.5 text-[13px] text-muted">
        <span className="inline-flex items-center gap-2">
          <Clock size={15} className="text-subtle" aria-hidden />
          {formatDueDateTime(event.start)}
        </span>
        <span className="inline-flex items-center gap-2">
          {online ? (
            <Video size={15} className="text-subtle" aria-hidden />
          ) : (
            <MapPin size={15} className="text-subtle" aria-hidden />
          )}
          {online ? 'Online event' : 'In person'} · {event.location}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!gate && added ? (
          <Link
            to="/app/calendar"
            className="inline-flex items-center gap-2 rounded-lg bg-success/15 px-4 py-2.5 text-[14px] font-medium text-success transition-colors duration-150 hover:bg-success/25"
          >
            <CalendarCheck size={16} aria-hidden />
            Added — view in calendar
          </Link>
        ) : (
          <button
            type="button"
            onClick={gate ?? onAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[14px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
          >
            <CalendarPlus size={16} aria-hidden />
            Add to my calendar
          </button>
        )}
        <RemindButton eventId={event.id} gate={gate} />
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-[14px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <Share2 size={16} aria-hidden />
          Share
        </button>
      </div>

      <Section label="About">
        <p className="text-[14px] leading-relaxed text-muted">{event.description}</p>
      </Section>

      <Section label={online ? 'How to join' : 'Where'}>
        {online ? <OnlineNote location={event.location} /> : <MapPlaceholder location={event.location} />}
      </Section>

      <Section label="Hosted by">
        <HostCard event={event} more={more} onOpenEvent={onOpenEvent} gate={gate} />
      </Section>
    </div>
  )
}

/** "Remind me" toggle — a STUB (in-memory, via the app store); real reminder
 * delivery is connection-phase. Sits beside "Add to my calendar". */
function RemindButton({ eventId, gate }: { eventId: string; gate?: () => void }) {
  const { isReminderSet, toggleReminder } = useAppData()
  const on = !gate && isReminderSet(eventId)
  return (
    <button
      type="button"
      onClick={gate ?? (() => toggleReminder(eventId))}
      aria-pressed={on}
      title={on ? 'Reminder set (mocked in this build)' : 'Remind me before this event (mocked)'}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[14px] font-medium transition-colors duration-150',
        on
          ? 'bg-accent-soft text-accent'
          : 'border border-border text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      {on ? <BellRing size={16} aria-hidden /> : <Bell size={16} aria-hidden />}
      {on ? 'Reminder set' : 'Remind me'}
    </button>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">{label}</h2>
      {children}
    </section>
  )
}

/** Static, non-interactive map placeholder (no live map in the seed). */
function MapPlaceholder({ location }: { location: string }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-xl border border-border bg-surface-2/40">
      <div className="ct-grid-bg absolute inset-0 opacity-70" aria-hidden />
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-contrast shadow-sm">
            <MapPin size={18} aria-hidden />
          </span>
          <span className="text-[13px] font-medium text-fg">{location}</span>
          <span className="text-[11px] text-subtle">Map preview — static in this build</span>
        </div>
      </div>
    </div>
  )
}

function OnlineNote({ location }: { location: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-4 py-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info/15 text-info">
        <Video size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{location}</p>
        <p className="text-[12px] text-subtle">A join link is shared with attendees before it starts.</p>
      </div>
    </div>
  )
}

function HostCard({
  event,
  more,
  onOpenEvent,
  gate,
}: {
  event: CampusEvent
  more: CampusEvent[]
  onOpenEvent: (id: string) => void
  gate?: () => void
}) {
  const { org } = event
  const identity = (
    <>
      <OrgLogo org={org} className="size-11" rounded="rounded-xl" textClass="text-[15px]" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[15px] font-semibold text-fg">
          <span className="truncate">{org.name}</span>
          {org.verified && <VerifiedBadge size={15} />}
        </p>
        <p className="truncate text-[12px] text-subtle">
          {org.handle}
          {org.verified && ' · Verified org'}
        </p>
      </div>
      <ChevronRight
        size={16}
        className="shrink-0 text-subtle transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
    </>
  )
  const identityClass =
    'group -m-1 flex items-center gap-3 rounded-lg p-1 text-left transition-colors duration-150 hover:bg-surface-2'

  return (
    <div className="rounded-2xl border border-border bg-surface-2/30 p-4">
      {gate ? (
        <button type="button" onClick={gate} className={cn(identityClass, 'w-full')}>
          {identity}
        </button>
      ) : (
        <Link to={`/app/community/org/${orgSlug(org)}`} className={identityClass}>
          {identity}
        </Link>
      )}

      <div className="mt-3 flex gap-2">
        {gate ? (
          <button
            type="button"
            onClick={gate}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            <UserPlus size={14} aria-hidden />
            Follow
          </button>
        ) : (
          <FollowButton handle={org.handle} className="flex-1" />
        )}
        <button
          type="button"
          onClick={gate}
          title="Contact (mocked in this build)"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <Mail size={14} aria-hidden />
          Contact
        </button>
      </div>

      {more.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            More from this host
          </p>
          <ul className="flex flex-col gap-1.5">
            {more.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpenEvent(e.id)}
                  className="group flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors duration-150 hover:bg-surface-2"
                >
                  <EventMedia event={e} variant="thumb" className="!size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-fg">{e.title}</span>
                    <span className="block truncate text-[11px] text-subtle">
                      {formatDueDateTime(e.start)}
                    </span>
                  </span>
                  <ChevronRight size={15} className="shrink-0 text-subtle" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
