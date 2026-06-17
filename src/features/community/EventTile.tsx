import { Link } from 'react-router-dom'
import { CalendarCheck, CalendarPlus, MapPin, Video } from 'lucide-react'
import type { CampusEvent, EventOrg } from '@/data/community'
import { withAlpha } from '@/lib/course-color'
import { formatDueDateTime } from '@/lib/date'
import { CATEGORY_META } from './category'
import { EventMedia } from './EventMedia'
import { VerifiedBadge } from './VerifiedBadge'
import { OrgLogo } from './OrgLogo'

/** One event — a media-forward card (grid) or a dense row (list). Host identity
 * LEADS ("who's it from" before "what is it"). Clicking opens the full-screen
 * detail; the add-to-calendar action is a separate sibling so it doesn't open it.
 *
 * Every card has the SAME fixed internal layout (fixed banner, 2-line title block,
 * single-line meta, bottom-pinned footer) so cards are uniform across the grid —
 * the Add button and bottom edge line up on every card regardless of content. */
export function EventTile({
  event,
  view,
  relevant,
  added,
  onOpen,
  onAdd,
}: {
  event: CampusEvent
  view: 'card' | 'row'
  relevant: boolean
  added: boolean
  onOpen: () => void
  onAdd: () => void
}) {
  if (view === 'row') {
    return (
      <article className="flex items-stretch overflow-hidden rounded-xl border border-border bg-surface transition-colors duration-150 hover:border-border-strong">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${event.title}`}
          className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
        >
          <EventMedia event={event} variant="thumb" />
          <div className="min-w-0 flex-1">
            <HostRow org={event.org} />
            <h3 className="mt-1 truncate text-[14px] font-medium text-fg">{event.title}</h3>
            <MetaLine event={event} relevant={relevant} />
          </div>
        </button>
        <div className="flex shrink-0 items-center p-3 pl-0">
          <AddAction added={added} onAdd={onAdd} title={event.title} />
        </div>
      </article>
    )
  }

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface transition-all duration-150 hover:border-border-strong hover:shadow-lg">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${event.title}`}
        className="block text-left"
      >
        <EventMedia event={event} variant="banner" />
        <div className="px-3.5 pt-3.5">
          <HostRow org={event.org} />
          <h3 className="mt-2 line-clamp-2 min-h-[2.75rem] text-[15px] leading-snug font-medium text-fg">
            {event.title}
          </h3>
          <MetaLine event={event} relevant={relevant} />
        </div>
      </button>
      <div className="mt-auto flex items-center justify-between gap-2 px-3.5 pt-3 pb-3">
        <CategoryTag category={event.category} />
        <AddAction added={added} onAdd={onAdd} title={event.title} />
      </div>
    </article>
  )
}

export function HostRow({ org }: { org: EventOrg }) {
  return (
    <div className="flex items-center gap-2">
      <OrgLogo org={org} className="size-7" rounded="rounded-md" textClass="text-[11px]" />
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[13px] leading-tight font-semibold text-fg">
          <span className="truncate">{org.name}</span>
          {org.verified && <VerifiedBadge size={14} />}
        </p>
        <p className="truncate text-[12px] leading-tight text-subtle">{org.handle}</p>
      </div>
    </div>
  )
}

/** A single, non-wrapping meta line so card height never varies: date is kept
 * whole, the location truncates, and the "For you" pill stays pinned right. */
function MetaLine({ event, relevant }: { event: CampusEvent; relevant: boolean }) {
  const online = event.mode === 'online'
  return (
    <div className="mt-1.5 flex min-h-[1.375rem] items-center gap-2 text-[12px] text-subtle">
      <span className="shrink-0 font-medium text-muted">{formatDueDateTime(event.start)}</span>
      <span className="inline-flex min-w-0 items-center gap-1">
        {online ? (
          <Video size={12} className="shrink-0" aria-hidden />
        ) : (
          <MapPin size={12} className="shrink-0" aria-hidden />
        )}
        <span className="truncate">{online ? 'Online' : event.location}</span>
      </span>
      {relevant && (
        <span className="ml-auto shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
          For you
        </span>
      )}
    </div>
  )
}

export function CategoryTag({ category }: { category: CampusEvent['category'] }) {
  const meta = CATEGORY_META[category]
  const Icon = meta.icon
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: withAlpha(meta.hex, 0.16), color: meta.hex }}
    >
      <Icon size={11} aria-hidden />
      {meta.label}
    </span>
  )
}

function AddAction({ added, onAdd, title }: { added: boolean; onAdd: () => void; title: string }) {
  if (added) {
    return (
      <Link
        to="/app/calendar"
        aria-label="Added to your calendar — view in calendar"
        className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-[12px] font-medium text-success transition-colors duration-150 hover:bg-success/25"
      >
        <CalendarCheck size={14} aria-hidden />
        Added
      </Link>
    )
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`Add "${title}" to my calendar`}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:bg-accent-soft hover:text-accent"
    >
      <CalendarPlus size={14} aria-hidden />
      Add
    </button>
  )
}
