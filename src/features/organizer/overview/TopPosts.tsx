import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Repeat2 } from 'lucide-react'
import { Panel } from '@/features/admin/admin-ui'
import { loadPosts, type FeedPost } from '@/lib/social-posts'
import { demoPosts, isDemoOrgId } from '@/lib/demo-org'
import type { EventOrg } from '@/data/community'

/** The club's three most-liked posts: what landed, so the next one can too. */
export function TopPosts({ orgId, org }: { orgId: string; org: EventOrg }) {
  const [posts, setPosts] = useState<FeedPost[] | null>(null)

  useEffect(() => {
    let alive = true
    const load = isDemoOrgId(orgId)
      ? Promise.resolve([...demoPosts(orgId, { handle: org.handle, name: org.name, color: org.color, glyph: org.glyph })])
      : loadPosts({ orgId, limit: 60 })
    void load
      .then((r) => alive && setPosts([...r].sort((a, b) => b.likes - a.likes).slice(0, 3)))
      .catch(() => alive && setPosts([]))
    return () => {
      alive = false
    }
  }, [orgId, org])

  return (
    <Panel title="Top posts" sub="By likes, all time" action={<Link to="/organizer/feed" className="text-[12.5px] font-medium text-accent hover:underline">Feed</Link>}>
      {posts === null ? (
        <div className="m-4 h-24 animate-pulse rounded-lg bg-surface-2/50" />
      ) : posts.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-subtle">Nothing posted yet. Your best post will show up here.</p>
      ) : (
        <ol className="divide-y divide-border">
          {posts.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-4 shrink-0 text-center text-[12px] font-semibold text-subtle tabular-nums">{i + 1}</span>
              <span className="size-11 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                {p.media[0] && <img src={p.media[0].url} alt="" className="size-full object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-fg">{p.caption || 'No caption'}</span>
                <span className="mt-0.5 flex items-center gap-3 text-[11.5px] text-subtle tabular-nums">
                  <span className="inline-flex items-center gap-1"><Heart size={12} aria-hidden />{p.likes}</span>
                  <span className="inline-flex items-center gap-1"><MessageCircle size={12} aria-hidden />{p.comments}</span>
                  <span className="inline-flex items-center gap-1"><Repeat2 size={12} aria-hidden />{p.reposts}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
