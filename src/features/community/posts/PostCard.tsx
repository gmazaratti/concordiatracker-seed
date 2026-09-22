import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  Heart,
  MessageCircle,
  Repeat2,
  Send,
  Trash2,
} from 'lucide-react'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import {
  deletePost,
  loadComments,
  togglePostLike,
  toggleRepost,
  type FeedPost,
  type PostComment,
} from '@/lib/social-posts'
import { savedAmong, toggleSave } from '@/lib/saves'
import { cn } from '@/lib/cn'
import { VerifiedBadge } from '../VerifiedBadge'
import { ShareSheet } from '../ShareSheet'
import { ModalShell } from '@/command/ModalShell'
import { submitTicket } from '@/lib/tickets'
import { muteOrg } from '../muted-orgs'
import { PostFollowButton } from './PostFollowButton'
import { CommentsSheet } from './CommentsSheet'

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
  const [saved, setSaved] = useState(false)
  const [reporting, setReporting] = useState(false)
  const strip = useRef<HTMLDivElement | null>(null)

  /** Scroll by exactly one frame. The strip owns the position — the dots and
   *  the counter read it — so moving it is the only thing to do here. */
  const step = (dir: -1 | 1) => {
    const el = strip.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' })
  }

  // One read per card is acceptable here because a card mounts once; the feed
  // does not re-ask on scroll. If this ever renders hundreds at a time, hoist
  // it to a single `savedAmong` for the whole page.
  useEffect(() => {
    let alive = true
    void savedAmong('post', [post.id]).then((set) => alive && setSaved(set.has(post.id)))
    return () => {
      alive = false
    }
  }, [post.id])

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

  const save = async () => {
    const next = !saved
    setSaved(next)
    const now = await toggleSave('post', post.id)
    if (now !== next) setSaved(now)
  }

  const openComments = () => {
    setShowComments(true)
    if (!comments) void loadComments(post.id).then(setComments)
  }

  return (
    <article className="border-b border-border pb-3">
      {/*
        NO EXTRA INSET. The feed column already pads by 16px and the media
        deliberately escapes it with `-mx-4`; adding another `px-3` here put
        the name 28px in while the picture started at 0, so the header read
        as belonging to something else.
      */}
      <header className="flex items-center gap-2.5 py-2.5 sm:px-1">
        <Link to={`/app/community/org/${slug}`} className="flex min-w-0 items-center gap-2.5">
          <Avatar post={post} />
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold text-fg">{slug}</span>
            {post.verified && <VerifiedBadge size={13} />}
          </span>
        </Link>
        <span className="shrink-0 text-[12px] text-subtle">· {ago(post.createdAt)}</span>
        <span className="min-w-1 flex-1" />
        {/* Nothing at all once you follow them — see PostFollowButton. */}
        <PostFollowButton handle={post.handle} />
        <DropdownMenu
          ariaLabel="Post options"
          items={[
            {
              id: 'report',
              label: 'Report post',
              icon: Flag,
              danger: true,
              onSelect: () => setReporting(true),
            },
            {
              id: 'mute',
              label: `Stop suggesting ${slug}`,
              icon: EyeOff,
              separated: true,
              onSelect: () => {
                muteOrg(post.orgId)
                setGone(true)
              },
            },
          ]}
        />
      </header>

      {/* Media. One image fills; several scroll-snap. */}
      <div className="group/media relative -mx-4 sm:mx-0">
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
            {/*
              ARROWS, BUT ONLY WHERE THERE IS A POINTER. A finger swipes the
              scroller and always could; a mouse had no way through the
              carousel at all, which made a multi-image post look like a
              single image on every desktop. Hidden until the card is
              hovered, so a quiet feed stays quiet.

              GLASS, not a flat scrim: `backdrop-blur` plus a low-alpha white
              means the button picks up whatever is behind it, so it stays
              legible on a dark photo and on a bright one without either
              being punched out.
            */}
            <Arrow side="left" disabled={slide === 0} onClick={() => step(-1)} />
            <Arrow
              side="right"
              disabled={slide === post.media.length - 1}
              onClick={() => step(1)}
            />
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

      <div className="flex items-center gap-1 px-2 pt-2 sm:px-0">
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
        {/* PRIVATE. A bookmark produces no count and tells the club nothing —
            that is what separates it from the repost two icons to the left. */}
        <button
          type="button"
          onClick={() => void save()}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from saved' : 'Save'}
          className={cn(
            'grid size-9 place-items-center rounded-full transition-colors duration-150',
            saved ? 'text-fg' : 'text-muted hover:text-fg',
          )}
        >
          <Bookmark size={19} className={cn(saved && 'fill-current')} aria-hidden />
        </button>
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

      {post.caption &&
        (expanded ? (
          <p className="px-3 pt-1.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-fg sm:px-1">
            <Link to={`/app/community/org/${slug}`} className="font-semibold hover:underline">
              {slug}
            </Link>{' '}
            {post.caption}
          </p>
        ) : (
          /*
           * ONE LINE, ALWAYS, with "more" beside it — the reference's shape.
           * A `line-clamp` cannot do this: it sets `display:-webkit-box`,
           * which would swallow the "more" button into the clamped box and
           * hide the very affordance that reveals the rest. A flex row with a
           * `truncate` child and a `shrink-0` button keeps the button on
           * screen no matter how long the caption is.
           */
          <div className="flex items-baseline gap-1 px-3 pt-1.5 sm:px-1">
            <p className="min-w-0 flex-1 truncate text-[13.5px] leading-relaxed text-fg">
              <Link to={`/app/community/org/${slug}`} className="font-semibold hover:underline">
                {slug}
              </Link>{' '}
              {post.caption}
            </p>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="shrink-0 text-[13.5px] text-subtle hover:text-fg"
            >
              more
            </button>
          </div>
        ))}

      {showComments && (
        <CommentsSheet
          postId={post.id}
          initial={comments}
          onCount={setCount}
          onClose={() => setShowComments(false)}
        />
      )}

      {reporting && (
        <ReportPost
          slug={slug}
          postId={post.id}
          onDone={() => setReporting(false)}
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

/**
 * A carousel arrow.
 *
 * `hidden sm:grid` — a finger swipes the scroller and always could; this
 * exists because a mouse had no way through a multi-image post at all, so
 * every desktop saw only the first picture.
 *
 * The glass is `backdrop-blur` over a low-alpha white rather than a flat
 * dark scrim: it takes on whatever is behind it, so the same button stays
 * legible over a night photo and a white one without either being punched
 * out of the image.
 */
function Arrow({
  side,
  disabled,
  onClick,
}: {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? 'Previous image' : 'Next image'}
      className={cn(
        'absolute top-1/2 z-10 hidden -translate-y-1/2 sm:grid',
        'size-8 place-items-center rounded-full border border-white/25 bg-white/15 text-white',
        'shadow-lg backdrop-blur-md backdrop-saturate-150',
        'transition-[opacity,transform] duration-200 hover:scale-105 active:scale-95',
        // Quiet until the card is hovered, so a still feed stays still.
        'opacity-0 group-hover/media:opacity-100 focus-visible:opacity-100',
        disabled && 'pointer-events-none !opacity-0',
        side === 'left' ? 'left-2' : 'right-2',
      )}
    >
      <Icon size={18} className={side === 'left' ? '-translate-x-px' : 'translate-x-px'} aria-hidden />
    </button>
  )
}

const REASONS = [
  'Spam or a scam',
  'Misleading or false',
  'Harassment or hate',
  'Nudity or sexual content',
  'Something else',
]

/**
 * Reporting a post.
 *
 * IT FILES A REAL SUPPORT TICKET rather than posting to a queue nobody
 * reads. The product already has one inbox for "a human needs to look at
 * this", it is already in the admin console, and the reporter can already
 * follow it in Messages — a second, invisible moderation queue would be a
 * promise we are not yet staffed to keep.
 *
 * The confirmation says what will actually happen, including that it is not
 * anonymous to us, because a report form that implies more than it does is
 * worse than none.
 */
function ReportPost({
  slug,
  postId,
  onDone,
}: {
  slug: string
  postId: string
  onDone: () => void
}) {
  const [reason, setReason] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async (r: string) => {
    setReason(r)
    setBusy(true)
    try {
      const { caseId } = await submitTicket({
        subject: `Reported post by @${slug}`,
        message: `Reason: ${r}\
Post: ${postId}\
Account: @${slug}`,
        category: 'other',
      })
      setSent(caseId || 'received')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send that report.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell label="Report post" onClose={onDone} widthClass="sm:max-w-sm">
      <div className="px-4 pt-3 pb-4">
        {sent ? (
          <div className="py-4 text-center">
            <p className="text-[15px] font-semibold text-fg">Thanks — we have it</p>
            <p className="mx-auto mt-1 max-w-xs text-[13px] leading-relaxed text-subtle">
              {sent === 'received'
                ? 'Someone will take a look.'
                : `It is ${sent} in your Messages, under Support, if you want to add anything.`}
            </p>
            <button
              type="button"
              onClick={onDone}
              className="mt-4 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="pr-9 text-[15px] font-semibold text-fg">Report this post</h2>
            <p className="mt-1 mb-3 text-[12.5px] leading-relaxed text-subtle">
              It opens a support conversation you can follow. Not anonymous to us.
            </p>
            <ul>
              {REASONS.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void send(r)}
                    className={cn(
                      'w-full rounded-xl px-2 py-2.5 text-left text-[14px] text-fg',
                      'transition-colors duration-150 hover:bg-surface-2 disabled:opacity-50',
                      reason === r && 'bg-surface-2',
                    )}
                  >
                    {r}
                  </button>
                </li>
              ))}
            </ul>
            {error && <p className="pt-2 text-[12px] text-warning">{error}</p>}
          </>
        )}
      </div>
    </ModalShell>
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
