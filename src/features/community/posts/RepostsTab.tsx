import { useEffect, useState } from 'react'
import { Repeat2 } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { loadPosts, loadReposts, type FeedPost, type RepostRow } from '@/lib/social-posts'
import { useCommunity } from '../useCommunity'
import { EventTile } from '../EventTile'
import { PostCard } from './PostCard'

/**
 * What this account has passed on — the second tab on every profile.
 *
 * ONE TAB FOR BOTH KINDS. An event and a post are both "a thing somebody else
 * published that I wanted on my page", and splitting them would give most
 * people two tabs with one item between them.
 *
 * THE ROWS ARE THE REAL CARDS. A repost renders the same `EventTile` and
 * `PostCard` the feed does, so it behaves the same — opens the same way, has
 * the same actions. A read-only copy would be a second rendering of the same
 * object, which is how two surfaces start disagreeing about a count.
 *
 * A TARGET THAT NO LONGER EXISTS IS SKIPPED, not drawn as a placeholder. The
 * club deleted it; showing a grey box that says so is telling you about
 * somebody else's housekeeping.
 */
export function RepostsTab({
  handle,
  isOrg = false,
  onOpenEvent,
}: {
  handle: string
  isOrg?: boolean
  onOpenEvent: (id: string) => void
}) {
  const { events } = useCommunity()
  const [rows, setRows] = useState<RepostRow[] | null>(null)
  const [posts, setPosts] = useState<Map<string, FeedPost>>(new Map())

  useEffect(() => {
    let alive = true
    void loadReposts(handle, isOrg)
      .then(async (r) => {
        if (!alive) return
        setRows(r)
        if (r.some((x) => x.kind === 'post')) {
          // One read for the page rather than one per row. The feed function
          // already returns counts and my own like state, so a reposted post
          // behaves exactly as it does in the feed.
          const all = await loadPosts({ limit: 50 })
          if (alive) setPosts(new Map(all.map((p) => [p.id, p])))
        }
      })
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [handle, isOrg])

  if (rows === null) return <p className="py-10 text-center text-[13px] text-subtle">Loading…</p>

  const resolved = rows
    .map((r) =>
      r.kind === 'event'
        ? { row: r, event: events.find((e) => e.id === r.targetId) }
        : { row: r, post: posts.get(r.targetId) },
    )
    .filter((x) => ('event' in x ? x.event : x.post))

  if (resolved.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <Mascot mood="resting" size="sm" soft className="text-accent" />
        <p className="text-[13.5px] font-medium text-fg">Nothing reposted yet</p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
          <Repeat2 size={12} className="mr-1 inline" aria-hidden />
          The repost button on an event or a post puts it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 py-4">
      {resolved.map((x) =>
        'event' in x && x.event ? (
          <EventTile
            key={x.row.id}
            event={x.event}
            view="row"
            relevant={false}
            added={false}
            onOpen={() => onOpenEvent(x.event!.id)}
            onAdd={() => onOpenEvent(x.event!.id)}
          />
        ) : 'post' in x && x.post ? (
          <PostCard key={x.row.id} post={x.post} />
        ) : null,
      )}
    </div>
  )
}
