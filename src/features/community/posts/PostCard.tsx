import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Clock,
  EyeOff,
  Flag,
  Heart,
  MapPin,
  MessageCircle,
  Send,
  Trash2,
  Unlink,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import {
  deletePost,
  postAspect,
  togglePostLike,
  toggleRepost,
  type FeedPost,
  type PostMedia,
} from '@/lib/social-posts'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { landingFrame, springSettled, springStep, type SpringState } from './carousel'
import { RepostGlyph } from './RepostGlyph'
import { savedAmong, toggleSave } from '@/lib/saves'
import { cn } from '@/lib/cn'
import { ShareSheet } from '../ShareSheet'
import { ModalShell } from '@/command/ModalShell'
import { submitTicket } from '@/lib/tickets'
import { muteOrg } from '../muted-orgs'
import { PostFollowButton } from './PostFollowButton'
import { CollabHeader, CollaboratorsSheet } from './CollabHeader'
import { removeCollaborator } from '@/lib/collab'
import { useMyOrgs } from '../useMyOrgs'
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
  const [count, setCount] = useState(post.comments)
  const [sharing, setSharing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [slide, setSlide] = useState(0)
  const [gone, setGone] = useState(false)
  /*
   * DELETING IS UNDOABLE FOR SIX SECONDS. The card becomes a bar saying so;
   * the delete is only sent when the time runs out — or when the card
   * unmounts, so navigating away commits it rather than quietly keeping a
   * post somebody asked to take down.
   */
  const [pendingDelete, setPendingDelete] = useState(false)
  const [deleteErr, setDeleteErr] = useState('')
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const commitDelete = useRef<(() => void) | null>(null)
  const [saved, setSaved] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [showCollabs, setShowCollabs] = useState(false)
  const strip = useRef<HTMLDivElement | null>(null)

  /**
   * ENDING A COLLABORATION IS SYMMETRIC, and the label says which end you are.
   *
   * Either club can undo it (`remove_collaborator` in the SQL enforces that,
   * and tells the other side) — the publisher takes a name off their post, the
   * co-author steps off one. Two sentences for one verb, because "Remove
   * collaborator" on a post that is not yours reads like you are deleting
   * somebody else's work.
   *
   * The entry is absent entirely when the viewer runs neither club, rather
   * than shown and refused.
   */
  const { orgs: myOrgs } = useMyOrgs()
  const removable = (() => {
    const collab = post.collaborators[0]
    if (!collab) return null
    const mine = new Set(myOrgs.map((o) => o.id))
    if (mine.has(post.orgId)) {
      return { orgId: post.orgId, target: collab.orgId, otherName: collab.name, myName: post.orgName }
    }
    const asCollab = post.collaborators.find((c) => mine.has(c.orgId))
    if (asCollab) {
      return { orgId: asCollab.orgId, target: asCollab.orgId, otherName: post.orgName, myName: asCollab.name }
    }
    return null
  })()

  const unlink = async () => {
    if (!removable) return
    await removeCollaborator(post.id, removable.target)
    // Reload rather than patch the card in place: removing a collaborator
    // changes whose profiles the post belongs on, and this component only
    // knows about one of them.
    onChanged?.()
  }

  /** Scroll by exactly one frame. The strip owns the position — the dots and
   *  the counter read it — so moving it is the only thing to do here. */
  const step = (dir: -1 | 1) => {
    const el = strip.current
    if (!el) return
    const w = Math.max(1, el.clientWidth)
    settle(Math.round(el.scrollLeft / w) + dir, 0)
  }

  /** Go to a frame by index — what a dot does. */
  const seek = (i: number) => settle(i, 0)

  /*
   * THE LANDING, ON A SPRING.
   *
   * `behavior: 'smooth'` decelerates to an exact stop, which reads as the
   * photo being put in place rather than coming to rest — and after a drag,
   * where the finger had real velocity, the handover to it is a visible snap.
   * A spring takes the release velocity as its own, overshoots a little and
   * settles, so the gesture and the animation are one movement.
   *
   * SNAP IS OFF FOR THE DURATION, for the same reason it is off during the
   * drag: `snap-mandatory` fights a `scrollLeft` written every frame and would
   * cancel the overshoot the moment it appeared.
   */
  const reduced = usePrefersReducedMotion()
  const anim = useRef(0)
  const settle = (index: number, velocity: number) => {
    const el = strip.current
    if (!el) return
    cancelAnimationFrame(anim.current)
    const w = Math.max(1, el.clientWidth)
    const target = Math.max(0, Math.min(post.media.length - 1, index)) * w
    if (reduced) {
      el.scrollLeft = target
      return
    }
    el.style.scrollSnapType = 'none'
    let state: SpringState = { x: el.scrollLeft, v: velocity }
    let last = performance.now()
    const frame = (now: number) => {
      // Clamped: a backgrounded tab hands back a gap of seconds, and a spring
      // integrated over one of those explodes.
      const dt = Math.min(0.032, Math.max(0.001, (now - last) / 1000))
      last = now
      state = springStep(state, target, dt)
      el.scrollLeft = state.x
      if (springSettled(state, target)) {
        el.scrollLeft = target
        el.style.scrollSnapType = ''
        return
      }
      anim.current = requestAnimationFrame(frame)
    }
    anim.current = requestAnimationFrame(frame)
  }
  useEffect(() => () => cancelAnimationFrame(anim.current), [])

  /*
   * CLICK AND DRAG THE PICTURE, on a pointer.
   *
   * MOUSE ONLY. A finger already drags this — it is a scroll container — and
   * taking the touch gesture over would replace the platform's momentum and
   * rubber-banding with ours, worse, and break the vertical scroll that
   * starts on a photo.
   *
   * SNAPPING IS SUSPENDED WHILE THE BUTTON IS DOWN. `snap-mandatory` fights a
   * scrollLeft written every frame — the strip yanks back to the nearest
   * frame mid-drag — so the snap is turned off for the drag and restored on
   * release, which is also the frame we choose a destination on.
   */
  const drag = useRef<{
    x: number
    left: number
    moved: boolean
    lastX: number
    lastT: number
    vx: number
  } | null>(null)
  const dragged = useRef(false)

  const onDragDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || post.media.length < 2) return
    const el = strip.current
    if (!el) return
    drag.current = {
      x: e.clientX,
      left: el.scrollLeft,
      moved: false,
      lastX: e.clientX,
      lastT: e.timeStamp,
      vx: 0,
    }
  }

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const el = strip.current
    if (!d || !el) return
    const dx = e.clientX - d.x
    if (!d.moved) {
      if (Math.abs(dx) < 4) return
      d.moved = true
      el.style.scrollSnapType = 'none'
      el.style.cursor = 'grabbing'
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // A pointer the browser has already forgotten; the drag still works.
      }
    }
    el.scrollLeft = d.left - dx
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.vx = ((e.clientX - d.lastX) / dt) * 1000
    d.lastX = e.clientX
    d.lastT = e.timeStamp
  }

  const onDragUp = () => {
    const d = drag.current
    const el = strip.current
    drag.current = null
    if (!d || !el) return
    el.style.scrollSnapType = ''
    el.style.cursor = ''
    if (!d.moved) return
    dragged.current = true
    const w = Math.max(1, el.clientWidth)
    const i = landingFrame({
      startLeft: d.left,
      scrollLeft: el.scrollLeft,
      width: w,
      velocity: d.vx,
      count: post.media.length,
    })
    // The flick's own velocity, handed to the spring so the landing continues
    // the gesture instead of restarting from nothing. Negated: a pointer
    // moving left scrolls the strip right.
    settle(i, -d.vx)
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

  useEffect(() => () => commitDelete.current?.(), [])

  const startDelete = () => {
    setDeleteErr('')
    setPendingDelete(true)
    const commit = () => {
      commitDelete.current = null
      if (deleteTimer.current) clearTimeout(deleteTimer.current)
      void deletePost(post.id).then((ok) => {
        if (ok) {
          setGone(true)
          onChanged?.()
        } else {
          setPendingDelete(false)
          setDeleteErr('That post could not be deleted. Try again.')
        }
      })
    }
    commitDelete.current = commit
    deleteTimer.current = setTimeout(commit, 6000)
  }
  const undoDelete = () => {
    if (deleteTimer.current) clearTimeout(deleteTimer.current)
    commitDelete.current = null
    setPendingDelete(false)
  }

  if (gone) return null
  if (pendingDelete) {
    return (
      <div role="status" className="mx-4 flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-muted sm:mx-0">
        <Trash2 size={15} className="shrink-0 text-subtle" aria-hidden />
        <span className="flex-1">Post deleted</span>
        <button type="button" onClick={undoDelete} className="rounded-full px-3 py-1 text-[13px] font-semibold text-accent hover:bg-accent-soft">
          Undo
        </button>
      </div>
    )
  }

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

  /* The sheet owns the list now (see lib/comments.ts) — the card held a
     private copy, which is what made a reopened thread look empty. */
  const openComments = () => setShowComments(true)

  return (
    <article className="border-b border-border pb-3">
      {deleteErr && (
        <p role="alert" className="mx-4 mb-2 rounded-lg bg-danger/10 px-3 py-2 text-[12.5px] text-danger sm:mx-0">
          {deleteErr}
        </p>
      )}
      {/*
        NO EXTRA INSET. The feed column already pads by 16px and the media
        deliberately escapes it with `-mx-4`; adding another `px-3` here put
        the name 28px in while the picture started at 0, so the header read
        as belonging to something else.
      */}
      <header className="flex items-center gap-2.5 py-2.5 sm:px-1">
        <CollabHeader post={post} onOpenSheet={() => setShowCollabs(true)} />
        <span className="shrink-0 text-[12px] text-subtle">· {ago(post.createdAt)}</span>
        <span className="min-w-1 flex-1" />
        {/* Nothing at all once you follow them — see PostFollowButton — and
            nothing on a post your own club made: following yourself is not
            an action anybody is looking for. */}
        {!canManage && <PostFollowButton handle={post.handle} />}
        <DropdownMenu
          ariaLabel="Post options"
          items={[
            ...(removable
              ? [
                  {
                    id: 'uncollab',
                    label:
                      removable.orgId === post.orgId
                        ? `Remove ${removable.otherName}`
                        : `Leave this post as ${removable.myName}`,
                    icon: Unlink,
                    onSelect: () => void unlink(),
                  },
                ]
              : []),
            {
              id: 'report',
              label: 'Report post',
              icon: Flag,
              danger: true,
              separated: !!removable,
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
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragUp}
          onPointerCancel={onDragUp}
          // A drag across a photo must not read as a click on whatever is
          // under the mouse when it stops.
          onClickCapture={(e) => {
            if (!dragged.current) return
            dragged.current = false
            e.stopPropagation()
            e.preventDefault()
          }}
          onDragStart={(e) => e.preventDefault()}
          onScroll={(e) => {
            const el = e.currentTarget
            setSlide(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
          }}
          /* THE BOX IS THE RIGHT SHAPE BEFORE ANYTHING IS IN IT. Every card
             used to be a hard square, so a portrait photo was cropped and a
             9:16 clip lost its top and bottom. The ratio comes from the first
             slide's real dimensions and applies to the whole strip, so a
             carousel does not resize under your thumb as you swipe. */
          style={{ aspectRatio: postAspect(post.media) }}
          className={cn(
            'flex snap-x snap-mandatory overflow-x-auto rounded-none sm:rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
            post.media.length > 1 && '[@media(hover:hover)]:cursor-grab',
          )}
        >
          {post.media.map((m, i) => (
            <Slide key={i} media={m} active={slide === i} eager={i === 0} />
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
            <Dots count={post.media.length} active={slide} onSeek={seek} />
          </>
        )}
      </div>

      {/* WHERE, AND WHEN IT GOES OUT — the two facts a caption should not have
          to carry. The schedule tag only ever renders for the team that wrote
          it: `post_feed` filters a queued post out for everybody else. */}
      {(post.place || post.publishAt) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 pt-1.5 sm:px-1">
          {post.place &&
            (post.placeUrl ? (
              <a
                href={post.placeUrl}
                target="_blank"
                rel="noreferrer noopener nofollow ugc"
                className="inline-flex min-w-0 items-center gap-1 text-[12.5px] text-info hover:underline"
              >
                <MapPin size={12} className="shrink-0" aria-hidden />
                <span className="truncate">{post.place}</span>
              </a>
            ) : (
              <span className="inline-flex min-w-0 items-center gap-1 text-[12.5px] text-subtle">
                <MapPin size={12} className="shrink-0" aria-hidden />
                <span className="truncate">{post.place}</span>
              </span>
            ))}
          {post.publishAt && new Date(post.publishAt) > new Date(post.createdAt) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-subtle">
              <Clock size={11} aria-hidden />
              Scheduled
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 px-2 pt-2 sm:px-0">
        <Action
          icon={Heart}
          label={liked ? 'Unlike' : 'Like'}
          // HIDDEN, NOT UNCOUNTED. The club asked for the number not to be
          // shown; the like still happened and still counts for them.
          count={post.hideLikes ? undefined : likes}
          on={liked}
          onColor="text-[#ff3b5c]"
          filled={liked}
          onClick={() => void like()}
        />
        <Action icon={MessageCircle} label="Comments" count={count} onClick={openComments} />
        <Action
          icon={RepostGlyph}
          label={reposted ? 'Undo repost' : 'Repost'}
          count={post.hideShares ? undefined : reposts}
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
            onClick={startDelete}
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
          /*
           * THE WHOLE LINE OPENS IT, not just the word "more".
           * A one-line caption with a 34px target at the end of it is a
           * target you aim at; the text itself is the obvious thing to tap
           * and was doing nothing. The handle stays a real link, so tapping
           * the name still goes to the club — the caption around it expands.
           */
          <div
            onClick={() => setExpanded(true)}
            className="flex cursor-pointer items-baseline gap-1 px-3 pt-1.5 sm:px-1"
          >
            <p className="min-w-0 flex-1 truncate text-[13.5px] leading-relaxed text-fg">
              <Link
                to={`/app/community/org/${slug}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold hover:underline"
              >
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

      {showCollabs && <CollaboratorsSheet post={post} onClose={() => setShowCollabs(false)} />}

      {showComments && (
        <CommentsSheet post={post} onCount={setCount} onClose={() => setShowComments(false)} />
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


function Action({
  icon: Icon,
  label,
  count,
  on,
  onColor,
  filled,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>
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
 * The slide dots — a control, not a readout.
 *
 * They looked exactly like this before and did nothing, which is the worst
 * version: a row of marks in the shape of a control that ignores a tap. Each
 * one is a button now, and dragging ALONG the row scrubs between frames the
 * way a phone's page dots do.
 *
 * A HORIZONTAL LOCK, so a vertical swipe that happens to begin on the dots is
 * still the page scrolling — the same rule the week grid and the due rows
 * follow. The row is only 6px of ink, so each dot carries a 16px tall target
 * around it.
 */
function Dots({
  count,
  active,
  onSeek,
}: {
  count: number
  active: number
  onSeek: (i: number) => void
}) {
  const row = useRef<HTMLDivElement>(null)
  const scrub = useRef<{ x: number; y: number; on: boolean } | null>(null)

  const at = (clientX: number): number => {
    const el = row.current
    if (!el) return active
    const r = el.getBoundingClientRect()
    const t = (clientX - r.left) / Math.max(1, r.width)
    return Math.min(count - 1, Math.max(0, Math.floor(t * count)))
  }

  return (
    <div
      ref={row}
      className="mt-2 flex touch-pan-y justify-center gap-1.5"
      onPointerDown={(e) => {
        scrub.current = { x: e.clientX, y: e.clientY, on: false }
      }}
      onPointerMove={(e) => {
        const s = scrub.current
        if (!s) return
        if (!s.on) {
          const dx = Math.abs(e.clientX - s.x)
          const dy = Math.abs(e.clientY - s.y)
          if (dx < 6 || dx <= dy) return
          s.on = true
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // Fine — the scrub just ends when the pointer leaves the row.
          }
        }
        const i = at(e.clientX)
        if (i !== active) onSeek(i)
      }}
      onPointerUp={() => {
        scrub.current = null
      }}
      onPointerCancel={() => {
        scrub.current = null
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Go to image ${i + 1}`}
          aria-current={i === active}
          onClick={() => onSeek(i)}
          className="grid h-4 w-3 place-items-center"
        >
          <span
            className={cn(
              'size-1.5 rounded-full transition-colors duration-150',
              i === active ? 'bg-accent' : 'bg-border-strong',
            )}
          />
        </button>
      ))}
    </div>
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
            <p className="text-[15px] font-semibold text-fg">Thanks, we have it</p>
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

/**
 * One slide: a picture, or a clip that plays itself.
 *
 * VIDEO BEHAVES LIKE A REEL AND THERE IS NO REELS TAB. A club posts a clip and
 * it sits in the feed between the photographs, which is the whole point — a
 * separate tab for one media type splits an already-small amount of content in
 * half and asks people to check two places.
 *
 * MUTED, LOOPING, AND IT ONLY PLAYS WHEN YOU CAN SEE IT. Autoplay with sound
 * is blocked by every browser anyway, and a video that keeps running after you
 * have scrolled past costs battery and data for something nobody is watching.
 * The observer pauses it the moment it leaves the viewport and the carousel
 * pauses every slide that is not the current one.
 *
 * SOUND IS A DELIBERATE TAP, and the control says which state it is in rather
 * than what it would do — a speaker icon that means "it is muted" and one that
 * means "press to mute" are the same icon, and this one is the former.
 */
function Slide({
  media,
  active,
  eager,
}: {
  media: PostMedia
  /** The slide the carousel is currently on. */
  active: boolean
  eager?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > 0.55),
      { threshold: [0, 0.55, 1] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (visible && active) {
      // A rejected play() is normal (a tab in the background, a data-saver
      // setting); it is not an error worth surfacing.
      void el.play().catch(() => {})
    } else {
      el.pause()
    }
  }, [visible, active])

  if (media.kind !== 'video') {
    return (
      <img
        src={media.url}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        className="size-full shrink-0 snap-center bg-surface-2 object-cover"
        style={{ width: '100%' }}
      />
    )
  }

  return (
    <div className="relative size-full w-full shrink-0 snap-center bg-black">
      <video
        ref={ref}
        src={media.url}
        muted={muted}
        loop
        playsInline
        preload={eager ? 'metadata' : 'none'}
        className="size-full object-contain"
      />
      <button
        type="button"
        onClick={() => setMuted((v) => !v)}
        aria-label={muted ? 'Sound is off' : 'Sound is on'}
        className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform duration-150 active:scale-90"
      >
        {muted ? <VolumeX size={15} aria-hidden /> : <Volume2 size={15} aria-hidden />}
      </button>
    </div>
  )
}
