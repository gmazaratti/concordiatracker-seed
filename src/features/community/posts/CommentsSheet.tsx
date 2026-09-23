import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { useComments } from '@/lib/comments'
import { postAspect, type FeedPost } from '@/lib/social-posts'
import { VerifiedBadge } from '../VerifiedBadge'
import { CommentThread } from './CommentThread'

const slugOf = (h: string) => h.replace(/^@/, '')

/**
 * Comments — a bottom sheet on a phone, the post itself on a desktop.
 *
 * TWO SHELLS, ONE THREAD. On a phone the picture is already on screen behind
 * the sheet, so the sheet is only the conversation. On a desktop the feed
 * column is 470px in the middle of a 1440px window and the post is small, so
 * opening comments is the moment to show it properly: the media on the left at
 * the size it was made for, the conversation in a column beside it. That is
 * the reference's layout and it is the right one for the same reason.
 *
 * `useComments` owns the list for both. The old version handed the card's copy
 * in as an initial value and refetched only when it was null, so a post whose
 * comments were empty when you first opened it showed an empty thread forever
 * — including the comment you had just written.
 */
export function CommentsSheet({
  post,
  onCount,
  onClose,
}: {
  post: FeedPost
  onCount: (n: number) => void
  onClose: () => void
}) {
  const { comments, add, like, pin, hide } = useComments(post.id)
  const desktop = useIsDesktop()

  // The card's badge follows the thread rather than being told a number by
  // whoever wrote last — one source, so they cannot disagree.
  const seen = useRef<number | null>(null)
  useEffect(() => {
    if (!comments) return
    if (seen.current === comments.length) return
    seen.current = comments.length
    onCount(comments.length)
  }, [comments, onCount])

  const thread = (
    <CommentThread
      post={post}
      comments={comments}
      liftComposer={!desktop}
      onAdd={add}
      onLike={(id) => void like(id)}
      onPin={(id, p) => void pin(id, p)}
      onHide={(id) => void hide(id)}
    />
  )

  if (!desktop) {
    return (
      <ModalShell label="Comments" onClose={onClose} widthClass="sm:max-w-md" scroll={false}>
        <div className="flex h-[72vh] flex-col sm:h-[68vh]">
          <header className="shrink-0 border-b border-border/70 pb-2.5 text-center">
            <h2 className="text-[14px] font-semibold text-fg">Comments</h2>
          </header>
          {thread}
        </div>
      </ModalShell>
    )
  }

  return <PostDetailModal post={post} onClose={onClose} thread={thread} />
}

/**
 * The desktop post view: media left, conversation right.
 *
 * NOT `ModalShell`. That one is a single column that becomes a bottom sheet
 * under `sm`, and this is a wide two-pane dialog that only ever exists above
 * `lg` — bending one into the other would have meant a shell with a mode flag
 * and two layouts inside it.
 */
function PostDetailModal({
  post,
  onClose,
  thread,
}: {
  post: FeedPost
  onClose: () => void
  thread: React.ReactNode
}) {
  const slug = slugOf(post.handle)
  const first = post.media[0]

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

  return createPortal(
    <div
      className="ct-animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Post"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-5 grid size-9 place-items-center rounded-full text-white/80 transition-colors duration-150 hover:bg-white/10 hover:text-white"
      >
        <X size={24} aria-hidden />
      </button>

      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="ct-animate-pop flex h-[min(88vh,880px)] w-full max-w-[1100px] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
      >
        {/* Left: the media at the size it was made for. Black behind it, so a
            portrait poster letterboxes rather than sitting on a panel that
            looks like a mistake. */}
        <div className="hidden min-w-0 flex-1 items-center justify-center bg-black lg:flex">
          {first &&
            (first.kind === 'video' ? (
              <video
                src={first.url}
                controls
                playsInline
                className="max-h-full max-w-full"
                style={{ aspectRatio: postAspect(post.media) }}
              />
            ) : (
              <img src={first.url} alt="" className="max-h-full max-w-full object-contain" />
            ))}
        </div>

        {/* Right: who posted it, then the conversation — with the description
            as its first row, which is where CommentThread puts it. */}
        <div className="flex w-full flex-col lg:w-[420px] lg:shrink-0 lg:border-l lg:border-border">
          <header className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
            <Link to={`/app/community/org/${slug}`} onClick={onClose} className="shrink-0">
              {post.logo ? (
                <img src={post.logo} alt="" className="size-8 rounded-full bg-surface-2 object-cover" />
              ) : (
                <span
                  className="grid size-8 place-items-center rounded-full text-[11px] font-semibold text-white"
                  style={{ background: post.color ?? '#4b5563' }}
                >
                  {(post.glyph || post.orgName.slice(0, 2)).toUpperCase()}
                </span>
              )}
            </Link>
            <span className="min-w-0 flex-1">
              <Link
                to={`/app/community/org/${slug}`}
                onClick={onClose}
                className="flex items-center gap-1.5"
              >
                <span className="truncate text-[13.5px] font-semibold text-fg">{slug}</span>
                {post.verified && <VerifiedBadge size={13} />}
              </Link>
              <span className="block truncate text-[12px] text-subtle">{post.orgName}</span>
            </span>
          </header>
          {thread}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Above `lg`, because that is where the two-pane layout has room — the media
 * pane alone wants 600px and the column beside it 420px.
 *
 * A hook rather than a CSS breakpoint: the two shells are different DOM, not
 * different styling on the same DOM, so the choice has to happen in render.
 */
function useIsDesktop(): boolean {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const on = (e: MediaQueryListEvent) => setWide(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

const QUERY = '(min-width: 1024px)'
