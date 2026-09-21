import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, MessageCircle, Repeat2, Send, Trash2 } from 'lucide-react'
import {
  addComment,
  deletePost,
  loadComments,
  togglePostLike,
  toggleRepost,
  type FeedPost,
  type PostComment,
} from '@/lib/social-posts'
import { cn } from '@/lib/cn'
import { VerifiedBadge } from '../VerifiedBadge'
import { ShareSheet } from '../ShareSheet'

/**
 * One post in the feed.
 *
 * FOUR ACTIONS, IN THE ORDER EVERYONE ALREADY KNOWS: like, comment, repost,
 * send. Reusing that order is not laziness — it is the reason nobody has to
 * learn this screen, and the repost icon in the third slot is exactly where
 * the brief asked for it.
 *
 * COUNTS ARE OPTIMISTIC AND REVERSIBLE. The heart fills on the tap and the
 * number moves with it; if the write is refused it goes back. A feed that
 * waits for a round trip before acknowledging a tap feels broken on campus
 * wifi, and a feed that never corrects itself lies.
 *
 * THE CAROUSEL IS A SCROLL CONTAINER, not a transform carousel. It gets swipe,
 * momentum, keyboard and a scrollbar for free from the platform, and the dots
 * read the scroll position rather than owning it — so the picture and the dot
 * can never disagree.
 */
export function PostCard({
  post,
  canManage = false,
  onChanged,
}: {
  post: FeedPost
  /** True when the viewer runs the club that published this. Passed in rather
   *  than derived here: the feed already knows which orgs are yours, and one
   *  membership query per card would be a query per scroll. */
  canManage?: boolean
  onChanged?: () => void
}) {
  const [liked, setLiked] = useState(post.iLike)
  const [likes, setLikes] = useState(post.likes)
  const [reposted, setReposted] = useState(post.iRepost)
  const [reposts, setReposts] = useState(post.reposts)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<PostComment[] | null>(null)
  const [count, setCount] = useState(post.comments)
  const [sharing, setSharing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [slide, setSlide] = useState(0)
  const [gone, setGone] = useState(false)
  const strip = useRef<HTMLDivElement | null>(null)

  if (gone) return null

  const slug = post.handle.replace(/^@/, '')
  const link = `${window.location.origin}/app/community/org/${slug}`

  const like = async () => {
    const next = !liked
    setLiked(next)
    setLikes((n) => Math.max(0, n + (next ? 1 : -1)))
    const ok = await togglePostLike(post.id, next)
    if (ok === null) {
      setLiked(!next)
      setLikes((n) => Math.max(0, n + (next ? -1 : 1)))
    }
  }

  const repost = async () => {
    const next = !reposted
    setReposted(next)
    setReposts((n) => Math.max(0, n + (next ? 1 : -1)))
    const now = await toggleRepost('post', post.id)
    if (now !== next) {
      setReposted(now)
      setReposts(post.reposts + (now ? 1 : 0))
    }
    onChanged?.()
  }

  const openComments = () => {
    setShowComments((v) => !v)
    if (!comments) void loadComments(post.id).then(setComments)
  }

  return (
    <article className="border-b border-border pb-3">
      <header className="flex items-center gap-2.5 px-1 py-2.5">
        <Link to={`/app/community/org/${slug}`} className="flex min-w-0 items-center gap-2.5">
          <Avatar post={post} />
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold text-fg">{slug}</span>
            {post.verified && <VerifiedBadge size={13} />}
          </span>
        </Link>
        <span className="shrink-0 text-[12px] text-subtle">· {ago(post.createdAt)}</span>
        <span className="flex-1" />
      </header>

      {/* Media. One image fills; several scroll-snap. */}
      <div className="relative -mx-1 sm:mx-0">
        <div
          ref={strip}
          onScroll={(e) => {
            const el = e.currentTarget
            setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          className="flex snap-x snap-mandatory overflow-x-auto rounded-none sm:rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {post.media.map((m, i) => (
            <img
              key={i}
              src={m.url}
              alt=""
              loading="lazy"
              className="aspect-square w-full shrink-0 snap-center bg-surface-2 object-cover"
            />
          ))}
        </div>
        {post.media.length > 1 && (
          <>
            <span className="absolute top-2.5 right-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums">
              {slide + 1}/{post.media.length}
            </span>
            <span className="mt-2 flex justify-center gap-1.5">
              {post.media.map((_, i) => (
                <span
                  key={i}
                  className={cn(
                    'size-1.5 rounded-full transition-colors duration-150',
                    i === slide ? 'bg-accent' : 'bg-border-strong',
                  )}
                />
              ))}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 px-1 pt-2">
        <Action
          icon={Heart}
          label={liked ? 'Unlike' : 'Like'}
          count={likes}
          on={liked}
          onColor="text-[#ff3b5c]"
          filled={liked}
          onClick={() => void like()}
        />
        <Action icon={MessageCircle} label="Comments" count={count} onClick={openComments} />
        <Action
          icon={Repeat2}
          label={reposted ? 'Undo repost' : 'Repost'}
          count={reposts}
          on={reposted}
          onColor="text-success"
          onClick={() => void repost()}
        />
        <Action icon={Send} label="Send" onClick={() => setSharing(true)} />
        <span className="flex-1" />
        {/* Only the club that published it. A delete button on somebody
            else's post is a support ticket waiting to happen. */}
        {canManage && (
          <button
            type="button"
            onClick={() => {
              void deletePost(post.id).then((ok) => ok && setGone(true))
            }}
            aria-label="Delete post"
            className="grid size-9 place-items-center rounded-full text-subtle transition-colors duration-150 hover:text-danger"
          >
            <Trash2 size={16} aria-hidden />
          </button>
        )}
      </div>

      {post.caption && (
        <p className="px-1 pt-1.5 text-[13.5px] leading-relaxed text-fg">
          <Link to={`/app/community/org/${slug}`} className="font-semibold hover:underline">
            {slug}
          </Link>{' '}
          {/* Trimmed in JS, not with `line-clamp`. A clamp sets
              `display:-webkit-box`, which would pull this span out of the
              inline flow it shares with the handle above it. */}
          <span className="whitespace-pre-wrap">
            {expanded || post.caption.length <= 140
              ? post.caption
              : post.caption.slice(0, 140).trimEnd() + '… '}
          </span>
          {!expanded && post.caption.length > 140 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="text-subtle hover:text-fg"
            >
              more
            </button>
          )}
        </p>
      )}

      {showComments && (
        <Comments
          postId={post.id}
          rows={comments}
          onAdded={(c) => {
            setComments((prev) => [...(prev ?? []), c])
            setCount((n) => n + 1)
          }}
        />
      )}

      {sharing && (
        <ShareSheet
          title={`${slug}'s post`}
          link={link}
          onClose={() => setSharing(false)}
        />
      )}
    </article>
  )
}

function Avatar({ post }: { post: FeedPost }) {
  if (post.logo) {
    return (
      <img
        src={post.logo}
        alt=""
        className="size-8 shrink-0 rounded-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
      />
    )
  }
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white"
      style={{ background: post.color ?? '#4b5563' }}
    >
      {(post.glyph || post.orgName.slice(0, 2)).toUpperCase()}
    </span>
  )
}

function Action({
  icon: Icon,
  label,
  count,
  on,
  onColor,
  filled,
  onClick,
}: {
  icon: typeof Heart
  label: string
  count?: number
  on?: boolean
  onColor?: string
  filled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[12.5px] tabular-nums transition-colors duration-150',
        on ? onColor : 'text-muted hover:text-fg',
      )}
    >
      <Icon size={19} className={cn(filled && 'fill-current')} aria-hidden />
      {count != null && count > 0 && <span>{count}</span>}
    </button>
  )
}

function Comments({
  postId,
  rows,
  onAdded,
}: {
  postId: string
  rows: PostComment[] | null
  onAdded: (c: PostComment) => void
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    const err = await addComment(postId, text)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    setBody('')
    setError(null)
    // Re-read rather than guess at the row the server made: it stamps the id
    // and the time, and a locally-invented comment would jump when the list
    // next refreshes.
    const fresh = await loadComments(postId)
    const mine = fresh.filter((c) => c.isMine).at(-1)
    if (mine) onAdded(mine)
  }

  return (
    <div className="mt-2 border-t border-border/60 px-1 pt-2">
      {rows === null ? (
        <p className="py-2 text-[12px] text-subtle">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-2 text-[12px] text-subtle">No comments yet.</p>
      ) : (
        <ul className="space-y-1.5 pb-2">
          {rows.map((c) => (
            <li key={c.id} className="text-[13px] leading-relaxed text-fg">
              <Link to={`/@${c.handle}`} className="font-semibold hover:underline">
                {c.handle}
              </Link>{' '}
              {c.body}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
          placeholder="Add a comment…"
          maxLength={1000}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[13px] text-fg placeholder:text-subtle focus:outline-none"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!body.trim() || busy}
          className="shrink-0 text-[12.5px] font-semibold text-accent disabled:opacity-40"
        >
          Post
        </button>
      </div>
      {error && <p className="pb-1 text-[11.5px] text-warning">{error}</p>}
    </div>
  )
}

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
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
