import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Pin, Send, Trash2 } from 'lucide-react'
import { PersonAvatar } from '../PersonAvatar'
import { buildThreads, type CommentThread as Thread, type PostComment } from '@/lib/comments'
import type { FeedPost } from '@/lib/social-posts'
import { useKeyboardInset } from '@/app/hooks/useKeyboardInset'
import { cn } from '@/lib/cn'

const QUICK = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂']

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
/** Module level: a clock read in a component body trips `react-hooks/purity`. */
function ago(iso: string): string {
  const d = Math.max(0, Date.now() - new Date(iso).getTime())
  if (d < MINUTE) return 'now'
  if (d < HOUR) return `${Math.floor(d / MINUTE)}m`
  if (d < DAY) return `${Math.floor(d / HOUR)}h`
  if (d < 7 * DAY) return `${Math.floor(d / DAY)}d`
  return `${Math.floor(d / (7 * DAY))}w`
}

const slugOf = (h: string) => h.replace(/^@/, '')

/**
 * THE DESCRIPTION IS THE FIRST ROW OF EVERY THREAD.
 *
 * Not a header above the comments — a row in the same list, in the same shape,
 * because that is what it is: the first thing said about this post, by the
 * account that posted it. Rendering it as separate chrome means the caption
 * scrolls away while the comments answering it stay, which is the one thing
 * a reader needs it for.
 *
 * It cannot be liked or replied to, and it carries no timestamp of its own
 * beyond the post's — those all belong to comments, and giving the caption
 * fake ones would invite somebody to use them.
 */
function DescriptionRow({ post }: { post: FeedPost }) {
  const slug = slugOf(post.handle)
  if (!post.caption.trim()) return null
  return (
    <li className="flex gap-3 pb-1">
      <Link to={`/app/community/org/${slug}`} className="shrink-0">
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
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] leading-snug text-fg">
          <Link to={`/app/community/org/${slug}`} className="font-semibold hover:underline">
            {slug}
          </Link>{' '}
          <span className="text-subtle">{ago(post.createdAt)}</span>
        </p>
        <p className="mt-0.5 text-[14px] leading-snug whitespace-pre-wrap text-fg">
          {post.caption}
        </p>
      </div>
    </li>
  )
}

function Row({
  c,
  isReply,
  onLike,
  onReply,
  onPin,
  onHide,
}: {
  c: PostComment
  isReply?: boolean
  onLike: () => void
  onReply: () => void
  onPin: () => void
  onHide: () => void
}) {
  return (
    <div className={cn('flex gap-3', isReply && 'pl-10')}>
      <Link to={`/@${c.handle}`} className="shrink-0">
        <PersonAvatar
          person={{ handle: c.handle, name: c.name, avatar_url: c.avatarUrl }}
          className={isReply ? 'size-7' : 'size-8'}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 text-[13.5px] leading-snug text-fg">
          <Link to={`/@${c.handle}`} className="font-semibold hover:underline">
            {c.handle}
          </Link>
          <span className="text-subtle">{ago(c.createdAt)}</span>
          {c.pinnedAt && (
            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-accent">
              <Pin size={10} aria-hidden /> Pinned
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[14px] leading-snug whitespace-pre-wrap text-fg">{c.body}</p>
        <div className="mt-1 flex items-center gap-3 text-[12px] text-subtle">
          <button type="button" onClick={onReply} className="font-medium hover:text-fg">
            Reply
          </button>
          {/* The post's own account approving a comment is the most useful
              signal in a thread, and it is a fact rather than a count — so it
              is a label, not a number. */}
          {c.likedByAuthor && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
              <Heart size={10} className="fill-[#ff3b5c] text-[#ff3b5c]" aria-hidden />
              Liked by author
            </span>
          )}
          {c.canPin && !c.parentId && (
            <button type="button" onClick={onPin} className="font-medium hover:text-fg">
              {c.pinnedAt ? 'Unpin' : 'Pin'}
            </button>
          )}
          {c.isMine && (
            <button
              type="button"
              onClick={onHide}
              aria-label="Delete comment"
              className="hover:text-danger"
            >
              <Trash2 size={12} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {/* The heart is its own column on the right, away from the quick-emoji
          row at the bottom — that one writes a character into the field and is
          a different thing entirely. */}
      <button
        type="button"
        onClick={onLike}
        aria-pressed={c.iLike}
        aria-label={c.iLike ? 'Unlike comment' : 'Like comment'}
        className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5 text-subtle transition-transform duration-150 active:scale-90"
      >
        <Heart
          size={14}
          className={cn(c.iLike && 'fill-[#ff3b5c] text-[#ff3b5c]')}
          aria-hidden
        />
        {c.likes > 0 && <span className="text-[11px] tabular-nums">{c.likes}</span>}
      </button>
    </div>
  )
}

/**
 * The thread and its composer — one component, two shells.
 *
 * The phone puts it in a bottom sheet and the desktop puts it in the right
 * column of a two-pane modal, and neither of those is a reason to have two
 * copies of "what a comment looks like".
 */
export function CommentThread({
  post,
  comments,
  onAdd,
  onLike,
  onPin,
  onHide,
  error,
  /** The composer moves with the keyboard only where it is a sheet. */
  liftComposer = false,
  header,
}: {
  post: FeedPost
  comments: PostComment[] | null
  onAdd: (body: string, parentId: string | null) => Promise<string | null>
  onLike: (id: string) => void
  onPin: (id: string, pinned: boolean) => void
  onHide: (id: string) => void
  error?: string | null
  liftComposer?: boolean
  header?: React.ReactNode
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [replyTo, setReplyTo] = useState<PostComment | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const inset = useKeyboardInset(liftComposer)

  const submit = async () => {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    const err = await onAdd(text, replyTo?.id ?? null)
    setBusy(false)
    if (err) {
      setLocalError(err)
      return
    }
    setBody('')
    setReplyTo(null)
    setLocalError(null)
  }

  const groups = comments ? buildThreads(comments) : null
  const shown: Thread[] = groups ? [...groups.pinned, ...groups.rest] : []

  return (
    <>
      {header}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ul className="space-y-3.5">
          <DescriptionRow post={post} />
          {comments === null ? (
            <li className="py-8 text-center text-[12.5px] text-subtle">Loading…</li>
          ) : shown.length === 0 ? (
            <li className="py-10 text-center">
              <p className="text-[15px] font-medium text-fg">No comments yet</p>
              <p className="mt-1 text-[13px] text-subtle">Start the conversation.</p>
            </li>
          ) : (
            shown.map((t) => (
              <li key={t.comment.id} className="space-y-2.5">
                <Row
                  c={t.comment}
                  onLike={() => onLike(t.comment.id)}
                  onReply={() => setReplyTo(t.comment)}
                  onPin={() => onPin(t.comment.id, !t.comment.pinnedAt)}
                  onHide={() => onHide(t.comment.id)}
                />
                {t.replies.map((r) => (
                  <Row
                    key={r.id}
                    c={r}
                    isReply
                    onLike={() => onLike(r.id)}
                    onReply={() => setReplyTo(t.comment)}
                    onPin={() => onPin(r.id, !r.pinnedAt)}
                    onHide={() => onHide(r.id)}
                  />
                ))}
              </li>
            ))
          )}
        </ul>
      </div>

      {(error || localError) && (
        <p className="shrink-0 px-4 pb-1 text-[11.5px] text-warning">{error ?? localError}</p>
      )}

      {/*
        THE COMPOSER IS THE ONLY THING THAT MOVES.
        Translated by the measured keyboard height rather than letting the
        browser reflow — see useKeyboardInset for why iOS leaves us no choice.
        The transition matches the keyboard's own easing closely enough that
        it reads as one movement; it is removed at rest so nothing is left
        with a settled transform (a transformed ancestor becomes the containing
        block for every fixed descendant — the bug that made the chat a sliver).
      */}
      <div
        style={
          inset > 0
            ? { transform: `translateY(-${inset}px)`, transition: 'transform 180ms ease-out' }
            : undefined
        }
        className={cn(
          'shrink-0 border-t border-border/70 bg-surface px-3 pt-2',
          // The sheet runs to the bottom of the screen now, so the inset lives
          // here — and goes away while the keyboard is up, because the home
          // indicator is behind the keyboard.
          inset > 0 ? 'pb-2' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3',
        )}
      >
        {replyTo && (
          <div className="mb-1.5 flex items-center gap-2 text-[12px] text-subtle">
            <span className="min-w-0 truncate">
              Replying to <span className="font-medium text-fg">{replyTo.handle}</span>
            </span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="ml-auto shrink-0 font-medium text-accent"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="-mx-1 mb-2 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {QUICK.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setBody((b) => b + e)}
              aria-label={`Add ${e}`}
              className="grid size-9 shrink-0 place-items-center rounded-full text-[19px] transition-transform duration-150 hover:bg-surface-2 active:scale-90"
            >
              {e}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2 rounded-[20px] border border-border bg-canvas py-1 pr-1 pl-3.5 transition-colors duration-150 focus-within:border-accent">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submit()}
            placeholder={replyTo ? `Reply to ${replyTo.handle}…` : 'Add a comment…'}
            maxLength={1000}
            aria-label="Add a comment"
            className="min-w-0 flex-1 self-center bg-transparent py-1.5 text-[15px] text-fg placeholder:text-subtle focus:outline-none lg:text-[14px]"
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!body.trim() || busy}
            tabIndex={body.trim() ? 0 : -1}
            aria-label="Post comment"
            className={cn(
              'grid h-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-accent-contrast',
              'transition-[width,opacity,transform] duration-200 ease-out hover:bg-accent-hover',
              body.trim() ? 'w-8 scale-100 opacity-100' : 'pointer-events-none w-0 scale-75 opacity-0',
            )}
          >
            <Send size={15} className="translate-x-px" aria-hidden />
          </button>
        </div>
      </div>
    </>
  )
}
