import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { useFollows } from '@/app/providers/follows'
import { useAppData } from '@/app/providers/app-data'
import { isRelevantTo, orgSlug, postedAgoLabel } from '@/data/community'
import { Mascot } from '@/components/Mascot'
import { useCommunity } from './useCommunity'
import { useEventActions } from './useEventActions'
import { EventTile } from './EventTile'
import { EventDetail } from './EventDetail'
import { OrgLogo } from './OrgLogo'
import { VerifiedBadge } from './VerifiedBadge'
import { FollowButton } from './FollowButton'
import { feedPosts, suggestOrgs } from './feed'

/**
 * Feed — the landing section: what the people and orgs you follow have posted.
 *
 * WHY IT IS NOT THE EVENTS TAB AGAIN. Events answers "what is on, and when" —
 * it is a browsable grid you filter by category and scan by date. Feed answers
 * "what is new since I last looked", ordered by when it was POSTED and led by
 * the orgs you chose to follow. The first is a directory; the second is a
 * river. The last time this tab had two sections showing one list it taught
 * people that the tabs meant nothing, so the distinction has to be real:
 * nothing here is sorted by start date, and nothing in Events is sorted by
 * posting date.
 *
 * Connection requests surface HERE rather than only behind the bell. A
 * notification you have to go and look for is not news; the bell is for
 * clearing the rest.
 *
 * This is deliberately still not a social network: nobody can post, there is
 * nothing to like, and the only things in the river are events an organisation
 * published.
 */
export function FeedSection({
  requests,
  onOpenActivity,
}: {
  /** Pending connection requests waiting on you. */
  requests: number
  onOpenActivity: () => void
}) {
  const { orgs, events, loading } = useCommunity()
  const { user } = useAppData()
  const { isFollowing, followedHandles } = useFollows()
  const { isAdded, add, openEvent, closeEvent, selectedEvent } = useEventActions()

  const posts = useMemo(() => feedPosts(events, isFollowing), [events, isFollowing])
  const suggestions = useMemo(
    () => suggestOrgs(orgs, events, isFollowing),
    [orgs, events, isFollowing],
  )

  return (
    <div className="mx-auto w-full max-w-2xl">
      {requests > 0 && (
        <button
          type="button"
          onClick={onOpenActivity}
          className="mb-4 flex w-full items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft px-3.5 py-3 text-left transition-colors duration-150 hover:border-accent"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
            <UserPlus size={16} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-fg">
              {requests === 1 ? 'Someone wants to connect' : `${requests} people want to connect`}
            </span>
            <span className="block text-[12px] text-subtle">Review the requests</span>
          </span>
        </button>
      )}

      {/* Suggestions come BEFORE the river only while it is thin: with nothing
          followed, a feed of strangers' events with no way to change that is a
          dead end. Once you follow things, the posts lead. */}
      {suggestions.length > 0 && followedHandles.length < 3 && (
        <Suggestions orgs={suggestions} />
      )}

      {loading && posts.length === 0 ? (
        <p className="px-1 py-10 text-center text-[13px] text-subtle">Loading…</p>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-14 text-center">
          <Mascot mood="resting" size="sm" soft className="text-accent" />
          <p className="text-[13.5px] font-medium text-fg">Nothing posted yet</p>
          <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
            Follow a few organisations and whatever they post lands here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map(({ event, followed }) => (
            <li key={event.id}>
              <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[11.5px] text-subtle">
                <span>{postedAgoLabel(event.postedDaysAgo)}</span>
                {!followed && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Suggested</span>
                  </>
                )}
              </p>
              <EventTile
                event={event}
                view="card"
                relevant={isRelevantTo(event, user.program, user.school)}
                added={isAdded(event)}
                onOpen={() => openEvent(event.id)}
                onAdd={() => add(event)}
              />
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && followedHandles.length >= 3 && (
        <div className="mt-5 border-t border-border pt-5">
          <Suggestions orgs={suggestions} />
        </div>
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

/** Orgs worth following, each with a real reason to exist in the list (they
 *  have something coming up — see `suggestOrgs`). */
function Suggestions({ orgs }: { orgs: ReturnType<typeof suggestOrgs> }) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Suggested for you
      </h2>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {orgs.map((org) => (
          <li key={org.handle} className="flex items-center gap-3 px-3 py-2.5">
            <Link to={`/app/community/org/${orgSlug(org)}`} className="min-w-0 flex-1">
              <span className="flex items-center gap-2.5">
                <OrgLogo org={org} className="size-9 shrink-0" rounded="rounded-full" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 text-[13px] font-medium text-fg">
                    <span className="truncate">{org.name}</span>
                    {org.verified && <VerifiedBadge size={13} />}
                  </span>
                  <span className="block truncate text-[12px] text-subtle">{org.handle}</span>
                </span>
              </span>
            </Link>
            <FollowButton handle={org.handle} />
          </li>
        ))}
      </ul>
    </section>
  )
}
