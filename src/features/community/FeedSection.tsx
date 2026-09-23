import { useEffect, useMemo, useRef, useState } from 'react'
import { Mascot } from '@/components/Mascot'
import { loadPosts, loadStoryRings, type FeedPost, type StoryRing } from '@/lib/social-posts'
import { PullToRefresh } from '@/components/PullToRefresh'
import { PostSkeleton, StoriesRowSkeleton } from '@/components/ui/Skeleton'
import { warm } from '@/lib/img-cache'
import { useMyOrgs } from './useMyOrgs'
import { mutedOrgs } from './muted-orgs'
import { StoriesRow } from './stories/StoriesRow'
import { StoryViewer } from './stories/StoryViewer'
import { StoryComposer } from './stories/StoryComposer'
import { PostCard } from './posts/PostCard'
import { EventTile } from './EventTile'
import { useCommunity } from './useCommunity'
import { useEventActions } from './useEventActions'
import { isRelevantTo, type CampusEvent } from '@/data/community'
import { useAppData } from '@/app/providers/app-data'
import { markSeen, orderFeed, seenIds, subscribeSeen } from '@/lib/seen-feed'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Feed — stories along the top, then what clubs have posted.
 *
 * WHAT WAS TAKEN OUT OF IT, and why each one:
 *
 *   • NOTIFICATIONS. A follow, a reply, a status change — those are the bell's
 *     job, and mixing them into a scroll means the one place you go to catch
 *     up is also the place you lose track of what you have already seen.
 *   • THE SUGGESTIONS BOARD. Product feedback is a different activity from
 *     looking at what is on campus, and a permanent link to it at the top of
 *     the feed made the feed read as a dashboard.
 *   • THE SEARCH FIELD. Instagram puts search on its own surface for a reason:
 *     a feed is for what came to you, and a field above it invites you to stop
 *     scrolling before you have started. The app's own magnifier covers it.
 *   • "POST SOMETHING AS <club>". A composer belongs where the thing you are
 *     composing lives — the club's own profile and the organizer portal — not
 *     at the top of everyone's reading surface.
 *
 * WHAT IS LEFT is what clubs put out — posts AND the events they published —
 * in the order it reached you. Events appear here as well as on their own tab
 * because a club announcing something should not have to post twice for it to
 * be seen, and the tabs still differ in the way that matters: this is ordered
 * by when it was PUBLISHED, Events by when it STARTS.
 *
 * UNSEEN FIRST, AND NOTHING IS EVER REMOVED. What you have already scrolled
 * past moves below a line that says so; it does not disappear, because a feed
 * that empties itself is the complaint this ordering exists to answer. See
 * lib/seen-feed.ts for why "seen" is per device.
 */
export function FeedSection() {
  const { orgs: myOrgs } = useMyOrgs()
  const [rings, setRings] = useState<StoryRing[]>([])
  const [posts, setPosts] = useState<FeedPost[] | null>(null)
  const [watching, setWatching] = useState<StoryRing | null>(null)
  const [composing, setComposing] = useState(false)
  const [refresh, setRefresh] = useState(0)

  useEffect(() => {
    let alive = true
    void loadStoryRings()
      .then((r) => {
        if (!alive) return
        setRings(r)
        // The ring row is the first thing on the screen and every logo in it
        // is tiny, so fetching them all costs almost nothing and removes the
        // most visible pop-in on the page.
        warm(r.map((x) => x.logo), 8)
      })
      .catch(() => {})
    void loadPosts({ limit: 30 })
      .then((r) => {
        if (!alive) return
        setPosts(r)
        /*
         * THE FIRST THREE PICTURES, AND ONLY THE FIRST THREE.
         *
         * A post image is the heaviest thing in Community and the slowest to
         * arrive on a phone, and the rows render long before it does. Warming
         * the top of the feed means the two or three cards somebody actually
         * sees before they scroll are already decoded; the rest stay lazy, so
         * this never turns into thirty parallel requests competing with the
         * one image that is on screen.
         *
         * It is a HINT. Nothing here awaits it and a failure is silent.
         */
        warm(
          r.slice(0, 3).flatMap((post) => post.media.slice(0, 1).map((m) => m.url)),
          3,
        )
      })
      .catch(() => alive && setPosts([]))
    return () => {
      alive = false
    }
  }, [refresh])

  const myOrgIds = useMemo(() => new Set(myOrgs.map((o) => o.id)), [myOrgs])
  /*
   * "Stop suggesting this club" has to actually stop it. Filtered on read
   * rather than at the query, because the list is per device and the server
   * has no business knowing it — see muted-orgs.ts.
   *
   * It does NOT need to re-run when you mute one: the card removes itself on
   * the spot, and this keeps it gone from every load after. Adding `refresh`
   * to the deps to force it would be a dependency the memo never reads.
   */
  const shown = useMemo(() => {
    if (!posts) return posts
    const muted = mutedOrgs()
    return muted.size === 0 ? posts : posts.filter((p) => !muted.has(p.orgId))
  }, [posts])

  /*
   * POSTS AND EVENTS, IN ONE RIVER.
   *
   * An event carries `postedDaysAgo` rather than a timestamp, so it is turned
   * into one here: the feed's whole ordering is "when did this reach me", and
   * two different units cannot be interleaved.
   */
  const { events } = useCommunity()
  const { user } = useAppData()
  const eventActions = useEventActions()
  const entries = useMemo<FeedEntry[] | null>(() => {
    if (shown === null) return null
    const muted = mutedOrgs()
    const fromEvents: FeedEntry[] = events
      .filter((e) => !muted.has(e.org.handle))
      .map((e) => ({
        kind: 'event' as const,
        id: `event:${e.id}`,
        at: postedAtOf(e),
        event: e,
      }))
    const fromPosts: FeedEntry[] = shown.map((p) => ({
      kind: 'post' as const,
      id: `post:${p.id}`,
      at: p.publishAt ?? p.createdAt,
      post: p,
    }))
    return [...fromPosts, ...fromEvents]
  }, [shown, events])

  /* Re-order when something is marked seen, but NOT while you are looking at
     it: the split is computed once per visit so a card cannot slide out from
     under the thumb that just scrolled it into view. */
  const [seenAtMount] = useState(() => seenIds())
  useEffect(() => subscribeSeen(() => undefined), [])
  const ordered = useMemo(
    () => (entries ? orderFeed(entries, seenAtMount) : null),
    [entries, seenAtMount],
  )

  /** Waits for the fetch, so the spinner is honest about when it is done. */
  const reload = () =>
    Promise.all([
      loadStoryRings().then(setRings).catch(() => {}),
      loadPosts({ limit: 30 }).then(setPosts).catch(() => {}),
    ]).then(() => undefined)

  return (
    <PullToRefresh onRefresh={reload} className="mx-auto w-full max-w-[470px]">
      {/* One or the other, never both: the skeleton IS the row until the
          rings land, so the top of the feed does not grow a second strip. */}
      {posts === null && rings.length === 0 ? (
        <StoriesRowSkeleton />
      ) : (
        <StoriesRow
          rings={rings}
          myOrgs={myOrgs}
          onOpen={(id) => setWatching(rings.find((r) => r.orgId === id) ?? null)}
          onCompose={() => setComposing(true)}
        />
      )}

      {ordered === null ? (
        /* The shape of the thing that is coming, not the word "Loading".
           The feed used to paint its text as soon as the rows landed and then
           leave a grey hole where each picture was going, so the page arrived
           in two stages and moved between them. */
        <PostSkeleton count={2} />
      ) : ordered.unseen.length + ordered.seen.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <Mascot mood="resting" size="sm" soft className="text-accent" />
          <p className="text-[13.5px] font-medium text-fg">Nothing posted yet</p>
          <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
            Follow a few clubs on the Events tab and what they post shows up here.
          </p>
        </div>
      ) : (
        <div>
          {ordered.unseen.map((e) => (
            <FeedItem
              key={e.id}
              entry={e}
              myOrgIds={myOrgIds}
              onChanged={() => setRefresh((n) => n + 1)}
              program={user.program}
              school={user.school}
              actions={eventActions}
            />
          ))}

          {/* THE LINE, and it only means anything if it is honest: it is drawn
              where the unseen run out, so it is absent on a first visit (when
              everything is new) and absent when there is nothing under it. */}
          {ordered.unseen.length > 0 && ordered.seen.length > 0 && <CaughtUp />}
          {ordered.unseen.length === 0 && ordered.seen.length > 0 && <CaughtUp />}

          {ordered.seen.map((e) => (
            <FeedItem
              key={e.id}
              entry={e}
              seen
              myOrgIds={myOrgIds}
              onChanged={() => setRefresh((n) => n + 1)}
              program={user.program}
              school={user.school}
              actions={eventActions}
            />
          ))}
        </div>
      )}

      {watching && (
        <StoryViewer
          rings={rings}
          startOrgId={watching.orgId}
          onClose={() => setWatching(null)}
          onSeen={() => setRefresh((n) => n + 1)}
        />
      )}
      {composing && myOrgs.length > 0 && (
        <StoryComposer
          orgs={myOrgs}
          onClose={() => setComposing(false)}
          onPosted={() => setRefresh((n) => n + 1)}
        />
      )}
    </PullToRefresh>
  )
}


/**
 * When an event reached the feed.
 *
 * Module level because a clock read in a component body trips
 * `react-hooks/purity` — the same reason `usageState` and the Today
 * upcoming/past split live outside their components.
 */
function postedAtOf(e: CampusEvent): string {
  return new Date(Date.now() - (e.postedDaysAgo ?? 0) * 86_400_000).toISOString()
}

/** One thing in the river: something a club posted, or something it published. */
type FeedEntry =
  | { kind: 'post'; id: string; at: string; post: FeedPost }
  | { kind: 'event'; id: string; at: string; event: CampusEvent }

/**
 * A card, plus the bit that decides it has been read.
 *
 * SEEN MEANS "IT WAS ON SCREEN AND YOU STAYED", not "it rendered". A card
 * scrolled past at speed is not read, and marking it would bury it before you
 * had a chance — so it needs half of itself visible for a second before it
 * counts. The observer is disconnected the moment it fires: there is nothing
 * to watch after that, and the alternative is one live observer per card for
 * as long as the feed is open.
 */
function FeedItem({
  entry,
  seen = false,
  myOrgIds,
  onChanged,
  program,
  school,
  actions,
}: {
  entry: FeedEntry
  seen?: boolean
  myOrgIds: Set<string>
  onChanged: () => void
  program?: string
  school?: string
  actions: ReturnType<typeof useEventActions>
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    let timer = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          timer = window.setTimeout(() => {
            markSeen(entry.id)
            io.disconnect()
          }, 1000)
        } else {
          window.clearTimeout(timer)
        }
      },
      { threshold: 0.5 },
    )
    io.observe(el)
    return () => {
      window.clearTimeout(timer)
      io.disconnect()
    }
  }, [entry.id, seen])

  return (
    <div ref={ref} className={cn(seen && 'opacity-[0.92]')}>
      {entry.kind === 'post' ? (
        <PostCard
          post={entry.post}
          canManage={myOrgIds.has(entry.post.orgId)}
          onChanged={onChanged}
        />
      ) : (
        <div className="px-3 py-2 sm:px-0">
          <EventTile
            event={entry.event}
            view="card"
            relevant={isRelevantTo(entry.event, program ?? '', school ?? '')}
            added={actions.isAdded(entry.event)}
            onOpen={() => actions.openEvent(entry.event.id)}
            onAdd={() => actions.add(entry.event)}
          />
        </div>
      )}
    </div>
  )
}

/** The end of what is new. Below it is everything you have already read. */
function CaughtUp() {
  return (
    <div className="flex items-center gap-3 px-4 py-6">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-subtle">
        <span className="grid size-5 place-items-center rounded-full bg-success/15 text-success">
          <Check size={12} aria-hidden />
        </span>
        You're all caught up
      </span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  )
}
