import { Clock, MapPin, MessageSquare, Phone } from 'lucide-react'
import type { EventOrg } from '@/data/community'
import { OrgLogo } from './OrgLogo'
import { FollowButton } from './FollowButton'
import { VerifiedBadge } from './VerifiedBadge'
import { ContactButton } from './ContactButton'
import { ProfileLinksRow } from './ProfileLinksRow'
import { orgProfileLinks } from './social'
import { RichBio } from '@/components/RichBio'
import { FallbackImg } from '@/components/ui/FallbackImg'

/**
 * The top of a club's public profile — banner, avatar, handle, counts, bio,
 * links, venue, actions.
 *
 * IT IS ITS OWN COMPONENT SO THE SETUP PREVIEW CAN BE THE REAL THING. The
 * wizard promises "this is what students see", and the only way to keep that
 * promise is for both screens to render the same markup rather than for one to
 * carry a small copy of the other. A copy is right on the day it is written and
 * wrong on the day either side is touched, and nobody finds out until a club
 * has published a profile that does not look like the picture it was shown.
 *
 * The preview does not pass a narrower version of this: it renders it at the
 * profile's own width and scales the whole thing down, so the proportions are
 * the page's and not a guess at them.
 */
export function OrgProfileHeaderView({
  org,
  followers,
  posts,
  upcoming,
  mine,
  onMessage,
}: {
  org: EventOrg
  followers: number
  posts: number
  upcoming: number
  /** Your own club hides Message — its inbox is in the portal. */
  mine?: boolean
  onMessage?: () => void
}) {
  const slug = org.handle.replace(/^@/, '')

  return (
    <>
      {/*
        THE SAME SHAPE A STUDENT'S PROFILE HAS, plus a banner.
        A club is an account here, not a different species of page — so the
        avatar sits left with the handle, the seal, the counts, the bio and
        the actions beside it, exactly as ProfileHeader lays them out. The
        banner is the one thing an org gets and a person does not, and it goes
        above all of it rather than reorganising what is underneath.
      */}
      <div
        className="relative h-32 overflow-hidden rounded-2xl sm:h-44"
        style={{ backgroundColor: org.color }}
      >
        {org.banner ? (
          // A dead URL steps aside so the brand colour shows through — never
          // an empty box, the rule every org image here follows.
          <FallbackImg src={org.banner} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/15 to-black/30" />
        )}
      </div>

      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-start sm:gap-10">
        <OrgLogo
          org={org}
          className="-mt-10 size-20 shrink-0 ring-4 ring-canvas sm:-mt-14 sm:size-36"
          rounded="rounded-full"
          textClass="text-3xl"
        />

        <div className="min-w-0 flex-1 sm:pt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-[20px] leading-tight font-semibold text-fg">{slug}</h1>
            {org.verified && <VerifiedBadge size={16} />}
            {/* SAID IN WORDS, not only in a seal. The seal means "this account
                is who it says it is"; this says "this is a club, not a
                person", which is a different fact and the one the brief asked
                to be unmistakable. */}
            <span className="rounded-full bg-info/15 px-2 py-0.5 text-[11px] font-semibold text-info">
              Organization
            </span>
          </div>
          <p className="mt-0.5 text-[13.5px] text-subtle">{org.name}</p>

          <div className="mt-3 flex items-center gap-5 text-[13.5px]">
            <Count n={posts} label="post" />
            <Count n={followers} label="follower" />
            <Count n={upcoming} label="upcoming" plural={false} />
          </div>

          {org.bio && (
            <RichBio
              text={org.bio}
              className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-fg/90"
            />
          )}

          {/* Under the description, where the reference puts it — and on the
              same column, so the line can never be wider than the bio it
              belongs to. */}
          <ProfileLinksRow links={orgProfileLinks(org.links)} />

          {org.venue && <VenueBlock venue={org.venue} />}

          <div className="mt-4 flex flex-wrap gap-2">
            <FollowButton handle={org.handle} />
            {/* A real conversation with the CLUB, not an email to whoever set
                it up. Hidden on your own club — its inbox is in the portal,
                and the database refuses a message to yourself anyway. */}
            {!mine && (
              <button
                type="button"
                onClick={onMessage}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                <MessageSquare size={14} aria-hidden />
                Message
              </button>
            )}
            <ContactButton org={org} />
          </div>
        </div>
      </div>
    </>
  )
}

function Count({ n, label, plural = true }: { n: number; label: string; plural?: boolean }) {
  return (
    <span>
      <strong className="font-semibold text-fg tabular-nums">{n}</strong>{' '}
      <span className="text-subtle">
        {label}
        {plural && n !== 1 ? 's' : ''}
      </span>
    </span>
  )
}

function VenueBlock({ venue }: { venue: NonNullable<EventOrg['venue']> }) {
  return (
    <div className="mt-3 max-w-md rounded-xl border border-border bg-surface/50 px-3.5 py-3">
      {venue.address && (
        <p className="flex items-start gap-2 text-[13px] text-fg">
          <MapPin size={13} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
          {venue.address}
        </p>
      )}
      {venue.phone && (
        <p className="mt-1.5 flex items-center gap-2 text-[13px]">
          <Phone size={13} className="shrink-0 text-subtle" aria-hidden />
          <a href={`tel:${venue.phone.replace(/[^\d+]/g, '')}`} className="text-fg hover:underline">
            {venue.phone}
          </a>
        </p>
      )}
      {venue.hours && venue.hours.length > 0 && (
        <div className="mt-2.5 flex items-start gap-2 border-t border-border/70 pt-2.5">
          <Clock size={13} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
          <ul className="text-[12.5px] leading-relaxed text-muted">
            {venue.hours.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
