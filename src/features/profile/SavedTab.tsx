import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { loadSaved, type SavedRow } from '@/lib/saves'
import { loadPosts, type FeedPost } from '@/lib/social-posts'
import { useCommunity } from '@/features/community/useCommunity'
import { EventTile } from '@/features/community/EventTile'
import { PostCard } from '@/features/community/posts/PostCard'

/**
 * What you bookmarked — yours only.
 *
 * NOTHING HERE IS VISIBLE TO ANYONE ELSE, including the club whose post you
 * saved. That is enforced by the RLS on `saves` (select-own) rather than by
 * this tab being rendered only for the owner: a tab is a display rule and the
 * privacy promise has to survive somebody calling the API directly.
 *
 * A target that has since been deleted is SKIPPED rather than drawn as a
 * placeholder — a grey box saying something is gone is telling you about
 * somebody else's housekeeping.
 */
export function SavedTab() {
  const { events } = useCommunity()
  const navigate = useNavigate()
  const [rows, setRows] = useState<SavedRow[] | null>(null)
  const [posts, setPosts] = useState<Map<string, FeedPost>>(new Map())

  useEffect(() => {
    let alive = true
    void loadSaved()
      .then(async (r) => {
        if (!alive) return
        setRows(r)
        if (r.some((x) => x.kind === 'post')) {
          const all = await loadPosts({ limit: 50 })
          if (alive) setPosts(new Map(all.map((p) => [p.id, p])))
        }
      })
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [])

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
        <p className="text-[13.5px] font-medium text-fg">Nothing saved yet</p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
          <Bookmark size={12} className="mr-1 inline" aria-hidden />
          The bookmark on a post or an event keeps it here. Only you can see this.
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
            onOpen={() => navigate(`/app/community?event=${x.event!.id}`)}
            onAdd={() => navigate(`/app/community?event=${x.event!.id}`)}
          />
        ) : 'post' in x && x.post ? (
          <PostCard key={x.row.id} post={x.post} />
        ) : null,
      )}
    </div>
  )
}
