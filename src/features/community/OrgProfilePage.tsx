import { useEffect, useState } from 'react'
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CalendarDays, Clock, Grid3x3, ImagePlus, MapPin, MessageSquare, Phone, Repeat2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { supabase } from '@/lib/supabase'
import { loadPosts, type FeedPost } from '@/lib/social-posts'
import { ProfileTabs } from '@/features/profile/ProfileHeader'
import { isRelevantTo, postedAgoLabel, type CampusEvent, type EventOrg, type OrgLinks } from '@/data/community'
import { startOfToday } from '@/lib/date'
import { cn } from '@/lib/cn'
import { EventTile } from './EventTile'
import { EventDetail } from './EventDetail'
import { OrgLogo } from './OrgLogo'
import { FollowButton } from './FollowButton'
import { VerifiedBadge } from './VerifiedBadge'
import { ContactButton } from './ContactButton'
import { SocialLinks } from './SocialLinks'
import { useEventActions } from './useEventActions'
import { useCommunity } from './useCommunity'
import { useMyOrgs } from './useMyOrgs'
import { PostCard } from './posts/PostCard'
import { PostComposer } from './posts/PostComposer'
import { RepostsTab } from './posts/RepostsTab'
import { MessageOrgModal } from './MessageOrgModal'

/** Counts and my relationship to this club, from one definer call. Followers
 *  CANNOT be counted client-side — org_follows is select-own, so a browser
 *  query returns 1 or 0 and calls it the follower count. */
interface OrgSocial {
  followers: number
  posts: number
  iManage: boolean
}

function useOrgSocial(handle: string | undefined): OrgSocial {
  const [state, setState] = useState<OrgSocial>({ followers: 0, posts: 0, iManage: false })
  useEffect(() => {
    if (!handle) return
    let alive = true
    void supabase.rpc('org_social', { p_handle: handle }).then(({ data }) => {
      if (!alive || !data) return
      const d = data as Record<string, unknown>
      setState({
        followers: Number(d.followers ?? 0),
        posts: Number(d.posts ?? 0),
        iManage: d.i_manage === true,
      })
    })
    return () => {
      alive = false
    }
  }, [handle])
  return state
}

/** Address, phone and opening hours for an org that is also a place. */
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

function ProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-6">
      <div className="ct-shimmer h-40 rounded-xl" />
      <div className="mt-4 flex items-end gap-3">
        <div className="ct-shimmer size-20 rounded-full" />
        <div className="ct-shimmer h-5 w-40 rounded" />
      </div>
      <div className="ct-shimmer mt-4 h-3 w-full rounded" />
      <div className="ct-shimmer mt-2 h-3 w-2/3 rounded" />
    </div>
  )
}

/** Full org profile — the host card expanded to a page: identity, bio, stats,
 * follow/contact, and ALL the org's events (upcoming + past, with when posted).
 * Reuses the event card components; opening an event uses the same `?event=`
 * detail overlay as the feed. */
export function OrgProfilePage() {
  const { handle } = useParams()
  const { user } = useAppData()
  const { orgBySlug, eventsByOrg, loading } = useCommunity()
  const { isAdded, add, openEvent, closeEvent, selectedEvent } = useEventActions()

  const org = handle ? orgBySlug(handle) : undefined
  /*
   * WAIT FOR THE DATA BEFORE DECIDING IT DOES NOT EXIST.
   * This redirected on `!org` alone, and the orgs arrive from Supabase a beat
   * after mount — so opening a profile from a shared link, a bookmark or a
   * reload bounced you to Community, at random, depending on which won the
   * race. It looked like the org was missing. It was not.
   */
  if (!org) {
    if (loading) return <ProfileSkeleton />
    return <Navigate to="/app/community" replace />
  }

  const { upcoming, past } = eventsByOrg(org.handle, startOfToday())
  const relevant = (e: CampusEvent) => isRelevantTo(e, user.program, user.school)

  return (
    <OrgProfileBody
      org={org}
      upcoming={upcoming}
      past={past}
      relevant={relevant}
      isAdded={isAdded}
      add={add}
      openEvent={openEvent}
      closeEvent={closeEvent}
      selectedEvent={selectedEvent}
    />
  )
}

/**
 * The profile itself — the same shape a student's profile has, marked as an
 * organisation.
 *
 * TABS, AND EVENTS IS FIRST. A club is judged on what it is running next, so
 * that is the landing tab; posts are the second thing you look at and reposts
 * the third. It is its own component because the page above it has to decide
 * whether the org exists before any hook here can run — calling them in the
 * parent would mean hooks above an early return.
 */
function OrgProfileBody({
  org,
  upcoming,
  past,
  relevant,
  isAdded,
  add,
  openEvent,
  closeEvent,
  selectedEvent,
}: {
  org: EventOrg
  upcoming: CampusEvent[]
  past: CampusEvent[]
  relevant: (e: CampusEvent) => boolean
  isAdded: (e: CampusEvent) => boolean
  add: (e: CampusEvent) => void
  openEvent: (id: string) => void
  closeEvent: () => void
  selectedEvent: CampusEvent | undefined
}) {
  const slug = org.handle.replace(/^@/, '')
  const social = useOrgSocial(slug)
  const { orgs: myOrgs } = useMyOrgs()
  /*
   * THE TAB IS IN THE URL. A post notification has to land on the post, and
   * "open the club, then press Posts" is the step that makes someone give up.
   * It is also what makes a club's own link to its posts shareable.
   */
  const [params, setParams] = useSearchParams()
  const urlTab = params.get('tab')
  const tab = urlTab === 'posts' || urlTab === 'reposts' ? urlTab : 'events'
  const setTab = (next: string) => {
    const p = new URLSearchParams(params)
    if (next === 'events') p.delete('tab')
    else p.set('tab', next)
    setParams(p, { replace: true })
  }
  const [posts, setPosts] = useState<FeedPost[] | null>(null)
  const [composing, setComposing] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const mine = myOrgs.find((o) => o.handle.replace(/^@/, '') === slug)

  /*
   * THE ID, RESOLVED ONCE. The URL carries a handle; posts and the inbox both
   * take an id. Looking it up per tab meant two round trips for the same fact
   * and left Message with nothing to address until Posts had been opened.
   */
  const [orgId, setOrgId] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    void supabase
      .from('organizations')
      .select('id')
      .ilike('handle', `%${slug}`)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setOrgId((data as { id?: string } | null)?.id ?? null)
      })
    return () => {
      alive = false
    }
  }, [slug])

  useEffect(() => {
    // Nothing to ask for until the handle has resolved. Setting an empty list
    // here would be a synchronous setState in an effect; `posts === null`
    // already renders as "loading", which is what is true.
    if (tab !== 'posts' || !orgId) return
    let alive = true
    void loadPosts({ orgId, limit: 30 }).then((rows) => alive && setPosts(rows))
    return () => {
      alive = false
    }
  }, [tab, orgId, refresh])

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-6">
      <Link
        to="/app/community"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        Community
      </Link>

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
          <img
            src={org.banner}
            alt=""
            className="absolute inset-0 size-full object-cover"
            onError={(e) => {
              // A dead URL hides itself so the brand colour shows through —
              // never an empty box, the rule every org image here follows.
              e.currentTarget.style.display = 'none'
            }}
          />
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
            <Count n={social.posts} label="post" />
            <Count n={social.followers} label="follower" />
            <Count n={upcoming.length} label="upcoming" plural={false} />
          </div>

          {org.bio && (
            <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed whitespace-pre-line text-fg/90">
              {org.bio}
            </p>
          )}

          {org.venue && <VenueBlock venue={org.venue} />}

          <div className="mt-4 flex flex-wrap gap-2">
            <FollowButton handle={org.handle} />
            {/* A real conversation with the CLUB, not an email to whoever set
                it up. Hidden on your own club — its inbox is in the portal,
                and the database refuses a message to yourself anyway. */}
            {!mine && (
              <button
                type="button"
                onClick={() => setMessaging(true)}
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

      {/* Divider: the social links sit ON it, right-aligned: the line ends,
          then the buttons, then a short segment continues to the right edge. */}
      <LinksDivider links={org.links} />

      <ProfileTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'events', label: 'Events', icon: CalendarDays, count: upcoming.length },
          { id: 'posts', label: 'Posts', icon: Grid3x3, count: social.posts },
          { id: 'reposts', label: 'Reposts', icon: Repeat2 },
        ]}
      />

      {tab === 'events' && (
        <>
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
        </>
      )}

      {tab === 'posts' && (
        <section className="pt-4">
          {mine && (
            <button
              type="button"
              onClick={() => setComposing(true)}
              className="mb-3 flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-accent"
            >
              <ImagePlus size={15} className="shrink-0 text-accent" aria-hidden />
              <span className="flex-1 text-[13px] text-muted">New post</span>
            </button>
          )}
          {posts === null ? (
            <p className="py-10 text-center text-[13px] text-subtle">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-10 text-center text-[13px] text-subtle">
              {org.name} has not posted anything yet.
            </p>
          ) : (
            <div className="space-y-4">
              {posts.map((po) => (
                <PostCard
                  key={po.id}
                  post={po}
                  canManage={social.iManage}
                  onChanged={() => setRefresh((n) => n + 1)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'reposts' && <RepostsTab handle={slug} isOrg onOpenEvent={openEvent} />}

      {messaging && (
        <MessageOrgModal
          org={{
            id: orgId,
            handle: org.handle,
            name: org.name,
            avatar: org.logo ?? null,
            color: org.color,
            glyph: org.glyph,
            verified: org.verified,
          }}
          onClose={() => setMessaging(false)}
        />
      )}

      {composing && mine && (
        <PostComposer
          orgs={[mine]}
          onClose={() => setComposing(false)}
          onPosted={() => setRefresh((n) => n + 1)}
        />
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

/** One of the three numbers under the name. Pluralised, because "1 posts"
 *  beside "1 followers" is what makes a page read as generated. `plural` is
 *  off for words that do not take an s ("upcoming"). */
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
