import { useEffect, useMemo, useState } from 'react'
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
 * WHAT IS LEFT is one thing: accounts you follow, in the order they published.
 * That is the whole reason a feed feels different from a directory, and Events
 * (sorted by when things START, filtered by category) is the directory.
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

      {shown === null ? (
        /* The shape of the thing that is coming, not the word "Loading".
           The feed used to paint its text as soon as the rows landed and then
           leave a grey hole where each picture was going, so the page arrived
           in two stages and moved between them. */
        <PostSkeleton count={2} />
      ) : shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
          <Mascot mood="resting" size="sm" soft className="text-accent" />
          <p className="text-[13.5px] font-medium text-fg">Nothing posted yet</p>
          <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
            Follow a few clubs on the Events tab and what they post shows up here.
          </p>
        </div>
      ) : (
        <div>
          {shown.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              canManage={myOrgIds.has(p.orgId)}
              onChanged={() => setRefresh((n) => n + 1)}
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
