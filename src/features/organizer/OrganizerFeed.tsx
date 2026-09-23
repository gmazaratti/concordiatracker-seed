import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2, Plus, X } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { loadPosts, type FeedPost } from '@/lib/social-posts'
import { PostComposer } from '@/features/community/posts/PostComposer'
import { PostCard } from '@/features/community/posts/PostCard'
import { Mascot } from '@/components/Mascot'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

/**
 * `/organizer/feed` — what the club has posted to Community.
 *
 * WHY THIS IS A SECTION AND NOT A CORNER OF EVENTS. A club publishes two
 * different KINDS of thing: an event is dated and goes on a calendar, a post
 * is a moment and goes in a river. The portal had a place for one of them, so
 * the other could only be made from the student app — which meant leaving the
 * dashboard to do the club's work.
 *
 * PREVIEW IS THE REAL FEED, not a mock of it. Everything on this page is the
 * component a student gets — `PostCard`, the same carousel, the same header —
 * so "what will this look like" is answered by the thing itself rather than
 * by a drawing that drifts the first time either side is touched.
 */
export function OrganizerFeed() {
  const { currentOrg, orgViewerPerms } = useTeacher()
  const orgId = currentOrg?.id ?? ''
  const [posts, setPosts] = useState<FeedPost[] | null>(null)
  const [composing, setComposing] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!orgId) return
    let alive = true
    void loadPosts({ orgId, limit: 60 })
      .then((r) => {
        if (!alive) return
        setPosts(r)
        setFailed(false)
      })
      .catch(() => {
        if (!alive) return
        // Loading and failing are different states: `posts === null` means
        // "still going", and a catch that sets `[]` tells somebody their
        // posts are gone.
        setFailed(true)
        setPosts([])
      })
    return () => {
      alive = false
    }
  }, [orgId, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  if (!currentOrg) return null

  const canPost = orgViewerPerms.manage_events || currentOrg.status === 'approved'

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold text-fg">Feed</h1>
          <p className="mt-0.5 text-[13px] text-subtle">
            Posts from {currentOrg.org.name} in the Community feed. Photos, a video, a
            note — anything that is not a dated event.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!posts || posts.length === 0}
            onClick={() => setPreviewing(true)}
          >
            <Eye size={15} aria-hidden />
            Preview in feed
          </Button>
          <Button size="sm" disabled={!canPost} onClick={() => setComposing(true)}>
            <Plus size={15} aria-hidden />
            New post
          </Button>
        </div>
      </header>

      {currentOrg.status !== 'approved' && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[12.5px] text-warning">
          Your club is waiting on approval. You can draft posts now; they reach students
          the moment it goes through.
        </p>
      )}

      {posts === null ? (
        <div className="grid min-h-[30vh] place-items-center">
          <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
        </div>
      ) : failed ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-8 text-center">
          <p className="text-[13px] text-subtle">Could not load your posts.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={refresh}>
            Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-12 text-center">
          <Mascot mood="resting" size="sm" soft className="text-accent" />
          <p className="text-[13.5px] font-medium text-fg">Nothing posted yet</p>
          <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
            A post is the quick one — a photo from last night, a reminder, a thank-you.
            Events live on their own tab.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} canManage onChanged={refresh} />
          ))}
        </div>
      )}

      {composing && (
        <PostComposer
          orgs={[
            {
              id: currentOrg.id,
              name: currentOrg.org.name,
              handle: currentOrg.org.handle,
              logo: currentOrg.org.logo ?? null,
              color: currentOrg.org.color,
              glyph: currentOrg.org.glyph,
              verified: currentOrg.org.verified,
            },
          ]}
          onClose={() => setComposing(false)}
          onPosted={() => {
            setComposing(false)
            refresh()
          }}
        />
      )}

      {previewing && posts && (
        <FeedPreview posts={posts} onClose={() => setPreviewing(false)} onChanged={refresh} />
      )}
    </div>
  )
}

/**
 * Your posts, in the feed a student sees.
 *
 * FULL SCREEN AND OVER EVERYTHING, because the question it answers is "how
 * does this look in the app" and answering it inside a dashboard panel half
 * the width shows something nobody will ever see. The banner is the one
 * difference, and it says so: everything under it is the real component.
 *
 * LIMITED TO YOUR OWN POSTS on purpose. A club previewing its work does not
 * need — and should not casually get — a feed of everybody else's inside its
 * own admin tool.
 */
function FeedPreview({
  posts,
  onClose,
  onChanged,
}: {
  posts: FeedPost[]
  onClose: () => void
  onChanged: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="ct-animate-fade fixed inset-0 z-[70] flex flex-col bg-canvas">
      <div
        className={cn(
          'flex shrink-0 items-center gap-3 border-b border-accent/40 bg-accent-soft',
          'px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))]',
        )}
      >
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-accent-contrast uppercase">
          Preview mode
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
          This is the Community feed, showing only your posts.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12.5px] font-medium text-fg transition-colors hover:bg-surface-2"
        >
          <X size={13} aria-hidden />
          Exit preview
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[470px] flex-col gap-5 px-4 py-5">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} canManage onChanged={onChanged} />
          ))}
          <p className="py-6 text-center text-[12px] text-subtle">
            End of your posts. A student would keep scrolling into everybody else's.
          </p>
        </div>
      </div>
    </div>
  )
}
