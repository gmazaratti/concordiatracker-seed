import { Link, Navigate, useParams } from 'react-router-dom'
import { ArrowLeft, Mail } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { isRelevantTo, postedAgoLabel, type CampusEvent, type OrgLinks } from '@/data/community'
import { startOfToday } from '@/lib/date'
import { cn } from '@/lib/cn'
import { EventTile } from './EventTile'
import { EventDetail } from './EventDetail'
import { OrgLogo } from './OrgLogo'
import { FollowButton } from './FollowButton'
import { VerifiedBadge } from './VerifiedBadge'
import { SocialLinks } from './SocialLinks'
import { useEventActions } from './useEventActions'
import { useCommunity } from './useCommunity'

/** Full org profile — the host card expanded to a page: identity, bio, stats,
 * follow/contact, and ALL the org's events (upcoming + past, with when posted).
 * Reuses the event card components; opening an event uses the same `?event=`
 * detail overlay as the feed. */
export function OrgProfilePage() {
  const { handle } = useParams()
  const { user } = useAppData()
  const { orgBySlug, eventsByOrg } = useCommunity()
  const { isAdded, add, openEvent, closeEvent, selectedEvent } = useEventActions()

  const org = handle ? orgBySlug(handle) : undefined
  if (!org) return <Navigate to="/app/community" replace />

  const { upcoming, past } = eventsByOrg(org.handle, startOfToday())
  const relevant = (e: CampusEvent) => isRelevantTo(e, user.program, user.school)

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-6">
      <Link
        to="/app/community"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        Community
      </Link>

      {/* Identity header — Twitter/X-inspired: banner, overlapping circular
          avatar, actions top-right, then name / handle / bio / stats. */}
      <div className="relative h-40 overflow-hidden rounded-2xl sm:h-52" style={{ backgroundColor: org.color }}>
        {org.banner ? (
          <img
            src={org.banner}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-black/30" />
        )}
      </div>

      <div className="flex items-start justify-between gap-3 px-1">
        <OrgLogo
          org={org}
          className="-mt-12 size-24 ring-4 ring-canvas sm:-mt-14 sm:size-28"
          rounded="rounded-full"
          textClass="text-3xl"
        />
        <div className="mt-3 flex gap-2">
          <FollowButton handle={org.handle} />
          <button
            type="button"
            title="Contact (mocked in this build)"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <Mail size={14} aria-hidden />
            Contact
          </button>
        </div>
      </div>

      <div className="mt-2 px-1">
        <h1 className="flex items-center gap-1.5 font-display text-[22px] leading-tight font-semibold text-fg">
          <span>{org.name}</span>
          {org.verified && <VerifiedBadge size={18} />}
        </h1>
        <p className="text-[14px] text-subtle">
          {org.handle}
          {org.verified && ' · Verified org'}
        </p>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-fg/90">{org.bio}</p>

        <div className="mt-3 flex gap-5 text-[14px]">
          <span>
            <strong className="font-semibold text-fg">{upcoming.length}</strong>{' '}
            <span className="text-subtle">upcoming</span>
          </span>
          <span>
            <strong className="font-semibold text-fg">{past.length}</strong>{' '}
            <span className="text-subtle">past events</span>
          </span>
        </div>
      </div>

      {/* Divider — the social links sit ON it, right-aligned: the line ends,
          then the buttons, then a short segment continues to the right edge. */}
      <LinksDivider links={org.links} />

      <section className="pt-5">
        <h2 className="mb-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Upcoming</h2>
        {upcoming.length > 0 ? (
          <EventGrid events={upcoming} relevant={relevant} isAdded={isAdded} add={add} openEvent={openEvent} />
        ) : (
          <p className="rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-8 text-center text-[13px] text-subtle">
            No upcoming events from {org.name} right now.
          </p>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-5 border-t border-border pt-5">
          <h2 className="mb-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Past</h2>
          <EventGrid events={past} relevant={relevant} isAdded={isAdded} add={add} openEvent={openEvent} muted />
        </section>
      )}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          added={isAdded(selectedEvent)}
          onAdd={() => add(selectedEvent)}
          onClose={closeEvent}
          onOpenEvent={openEvent}
        />
      )}
    </div>
  )
}

/** The section divider with the org's social links embedded on the right: a long
 * line, the link buttons, then a short segment continuing to the right edge. With
 * no links it's just a plain full-width rule (so it never looks broken). */
function LinksDivider({ links }: { links?: OrgLinks }) {
  const hasLinks = !!links && Object.values(links).some((v) => v && v.trim())
  if (!hasLinks) return <div className="mt-5 border-t border-border" />

  return (
    <div className="mt-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <SocialLinks links={links} className="flex items-center gap-2" />
      <span className="h-px w-12 shrink-0 bg-border" aria-hidden />
    </div>
  )
}

function EventGrid({
  events,
  relevant,
  isAdded,
  add,
  openEvent,
  muted = false,
}: {
  events: CampusEvent[]
  relevant: (e: CampusEvent) => boolean
  isAdded: (e: CampusEvent) => boolean
  add: (e: CampusEvent) => void
  openEvent: (id: string) => void
  muted?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
      {events.map((e) => (
        <div key={e.id} className={cn('flex flex-col gap-1.5', muted && 'opacity-80')}>
          <EventTile
            event={e}
            view="card"
            relevant={relevant(e)}
            added={isAdded(e)}
            onOpen={() => openEvent(e.id)}
            onAdd={() => add(e)}
          />
          <p className="px-0.5 text-[11px] text-subtle">Posted {postedAgoLabel(e.postedDaysAgo)}</p>
        </div>
      ))}
    </div>
  )
}
