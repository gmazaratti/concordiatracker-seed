import { useCallback, useEffect, useState } from 'react'
import { Eye, Loader2, Plus } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { loadPostDrafts, loadPosts, type FeedPost, type PostDraft } from '@/lib/social-posts'
import { demoPosts, isDemoOrgId } from '@/lib/demo-org'
import { PostComposer } from '@/features/community/posts/PostComposer'
import { PostCard } from '@/features/community/posts/PostCard'
import { Mascot } from '@/components/Mascot'
import { Button } from '@/components/ui/Button'
import { FeedPreview } from './feed/FeedPreview'
import { PostDrafts } from './feed/PostDrafts'

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
  const { currentOrg, orgPerms } = useTeacher()
  const orgId = currentOrg?.id ?? ''
  const org = currentOrg?.org
  const [posts, setPosts] = useState<FeedPost[] | null>(null)
  const [drafts, setDrafts] = useState<PostDraft[]>([])
  // `true` for a new post, a draft to pick up where somebody left off.
  const [composing, setComposing] = useState<PostDraft | true | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [tick, setTick] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!orgId || !org) return
    let alive = true
    // The demo's id is not a uuid; its posts live in the sandbox.
    const load = isDemoOrgId(orgId)
      ? Promise.resolve([...demoPosts(orgId, { handle: org.handle, name: org.name, color: org.color, glyph: org.glyph })])
      : loadPosts({ orgId, limit: 60 })
    void loadPostDrafts(orgId)
      .then((d) => alive && setDrafts(d))
      .catch(() => alive && setDrafts([]))
    void load
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
  }, [orgId, org, tick])

  const refresh = useCallback(() => setTick((t) => t + 1), [])
  if (!currentOrg) return null

  // Two different permissions: WRITING (a draft is enough) and PUTTING IT OUT.
  // Somebody who can only draft still gets the composer; it saves drafts.
  const canPublish = !!orgPerms && (orgPerms.is_owner || orgPerms.post_feed)
  const canWrite = !!orgPerms && (canPublish || orgPerms.post_create || orgPerms.draft_content)

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[22px] font-semibold text-fg">Feed</h1>
          <p className="mt-0.5 text-[13px] text-subtle">
            Posts from {currentOrg.org.name} in the Community feed. Photos, a video, a
            note: anything that is not a dated event.
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
          <Button size="sm" disabled={!canWrite} onClick={() => setComposing(true)}>
            <Plus size={15} aria-hidden />
            {canPublish ? 'New post' : 'New draft'}
          </Button>
        </div>
      </header>

      {currentOrg.status !== 'approved' && (
        <p className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 text-[12.5px] text-warning">
          Your club is waiting on approval. You can draft posts now; they reach students
          the moment it goes through.
        </p>
      )}

      <PostDrafts drafts={drafts} canPublish={canPublish} onOpen={(d) => setComposing(d)} onChanged={refresh} />

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
            A post is the quick one: a photo from last night, a reminder, a thank-you.
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
          canPublish={canPublish}
          draft={composing === true ? undefined : composing}
          onClose={() => setComposing(null)}
          onPosted={() => {
            setComposing(null)
            refresh()
          }}
        />
      )}

      {previewing && posts && <FeedPreview posts={posts} org={currentOrg.org} onClose={() => setPreviewing(false)} />}
    </div>
  )
}
