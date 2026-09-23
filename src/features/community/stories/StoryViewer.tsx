import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Eye,
  Flag,
  Heart,
  MapPin,
  Pause,
  Play,
  Send,
  X,
} from 'lucide-react'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { useFollows } from '@/app/providers/follows'
import { muteOrg } from '../muted-orgs'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { sendMessageToOrg } from '@/lib/org-messages'
import {
  loadStoryReel,
  markStorySeen,
  type Story,
  type StoryRing,
} from '@/lib/social-posts'
import { cn } from '@/lib/cn'
import { VerifiedBadge } from '../VerifiedBadge'
import { animClass, fontClass, storyAge } from './story-text'
import { ShareSheet } from '../ShareSheet'

const SEGMENT_MS = 5000
/** Past this much downward travel, letting go closes the reel. */
const DISMISS = 110
/** Below this, a gesture is still a tap and the halves get it. */
const GESTURE = 10
/** Module level so reading the clock is allowed — the same shape as `ago` in
 *  PeoplePanel (`react-hooks/purity` bars a clock read in a component body). */
const now = () => Date.now()

/**
 * A story, full screen.
 *
 * WHY A PORTAL AND NOT A ROUTE. It is a modal over whatever you were reading,
 * and you land back exactly where you were — which a route cannot promise once
 * the feed has scrolled. It is also portaled to `document.body` for the reason
 * recorded after the chat-embed bug: any ancestor with a settled `transform`
 * becomes the containing block for a fixed child, and this page has animated
 * wrappers all over it.
 *
 * SEEN IS RECORDED, WATCHERS ARE NOT REVEALED. The club is told how many
 * people watched; `story_views` is select-own, so it can never be told which
 * ones. Same line the organizer metrics draw.
 *
 * REPLIES GO TO THE CLUB'S INBOX. They are still ordinary rows in `messages`
 * — so blocks and the limits apply with no second path — but addressed to the
 * ORGANISATION rather than to whoever happens to own it. A reply that lands in
 * one person's DMs is a reply the club loses when they graduate.
 */
export function StoryViewer({
  rings,
  startOrgId,
  onClose,
  onSeen,
}: {
  /**
   * THE WHOLE ROW, not one club's reel.
   *
   * A reel that closes when a club runs out makes you tap back into the row
   * for every account, which is the opposite of what the format is for. The
   * viewer walks the row the way it is ordered on screen and only closes
   * after the last story of the last club.
   */
  rings: StoryRing[]
  startOrgId: string
  onClose: () => void
  /** Told when a story is marked seen so the row can drop its gradient. */
  onSeen?: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const [ringIndex, setRingIndex] = useState(() =>
    Math.max(0, rings.findIndex((r) => r.orgId === startOrgId)),
  )
  const ring = rings[ringIndex] ?? rings[0]
  const [stories, setStories] = useState<Story[] | null>(null)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reply, setReply] = useState('')
  const [sent, setSent] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [liked, setLiked] = useState(false)
  const timer = useRef<number | null>(null)
  const replyRef = useRef<HTMLInputElement>(null)
  /** How far the reel has been dragged down, in px. Drives both the transform
   *  and the backdrop's opacity, so the gesture is 1:1 the whole way. */
  const [drag, setDrag] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const touch = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null)
  const { isFollowing, toggleFollow } = useFollows()
  const navigate = useNavigate()

  const orgId = ring?.orgId
  useEffect(() => {
    if (!orgId) return
    let alive = true
    void loadStoryReel(orgId).then((rows) => {
      if (!alive) return
      setStories(rows)
      // Start on the first unwatched one, the way a reel resumes.
      const first = rows.findIndex((s) => !s.seen)
      setI(first === -1 ? 0 : first)
    })
    return () => {
      alive = false
    }
  }, [orgId])

  const story = stories?.[i]

  const next = useCallback(() => {
    if (!stories) return
    if (i + 1 < stories.length) {
      setI(i + 1)
      return
    }
    // End of this club's reel: on to the next one in the row, and only close
    // after the last.
    if (ringIndex + 1 < rings.length) {
      setStories(null)
      setI(0)
      setRingIndex(ringIndex + 1)
      return
    }
    onClose()
  }, [stories, i, ringIndex, rings.length, onClose])

  /** Back past the first story steps into the previous club's LAST one. */
  const prev = useCallback(() => {
    if (i > 0) {
      setI(i - 1)
      return
    }
    if (ringIndex > 0) {
      setStories(null)
      setI(0)
      setRingIndex(ringIndex - 1)
    }
  }, [i, ringIndex])

  /*
   * Reset the per-story controls DURING RENDER, tracking which story they were
   * reset for. An effect that setStates on arrival renders twice and trips
   * react-hooks/set-state-in-effect — the same shape ScheduleAccess uses.
   */
  const [shownFor, setShownFor] = useState<string | null>(null)
  if (story && shownFor !== story.id) {
    setShownFor(story.id)
    setLiked(story.liked)
    setSent(false)
    setReply('')
  }

  // Marking it seen is a WRITE, so it stays in an effect. Separate from the
  // advance timer, so a story you pause or back into still counts as watched.
  useEffect(() => {
    if (!story) return
    void markStorySeen(story.id).then(() => onSeen?.())
  }, [story, onSeen])

  /*
   * THE ADVANCE, AND IT RESUMES RATHER THAN RESTARTS.
   *
   * The old timer was `setTimeout(next, SEGMENT_MS)` in an effect that
   * depended on `paused`, so every pause threw the timer away and every
   * release started a fresh five seconds — hold for four seconds and you got
   * nine. `left` carries what is actually remaining, and the bar is driven
   * from the same number, so what you see and what happens are one thing.
   */
  const [left, setLeft] = useState(SEGMENT_MS)
  const startedAt = useRef(0)

  // A new story resets the clock. During render, tracked by id, for the same
  // reason the controls above are — an effect here renders twice.
  const [timedFor, setTimedFor] = useState<string | null>(null)
  if (story && timedFor !== story.id) {
    setTimedFor(story.id)
    setLeft(SEGMENT_MS)
  }

  useEffect(() => {
    if (!story || paused) return
    startedAt.current = Date.now()
    timer.current = window.setTimeout(next, left)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      // Bank what was left, so the next run picks up where this one stopped.
      // Guarded above zero: a cleanup that fires after the timeout already
      // ran would otherwise store a negative and the next story would skip.
      setLeft((ms) => Math.max(0, ms - (Date.now() - startedAt.current)))
    }
    // `left` is deliberately NOT a dependency: it is written by this effect's
    // own cleanup, and depending on it would restart the timer every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, paused, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose, next, prev])

  const send = async () => {
    const body = reply.trim()
    if (!body || !story) return
    setReply('')
    // Named so the recipient knows what it answers — a bare line arriving out
    // of nowhere is the reason story replies feel like spam elsewhere.
    const err = await sendMessageToOrg(ring.orgId, `Replying to your story: ${body}`)
    setSent(!err)
    if (err) setReply(body)
  }

  /*
   * DOWN CLOSES, UP REPLIES, HOLD PAUSES — the three gestures every story reel
   * has, and the reason the tap halves alone were not enough: on a phone the
   * only way out of this was a 32px X in the corner, which is the hardest
   * target on the screen to hit one-handed.
   *
   * The drag is 1:1 and the reel goes WITH the finger, so letting go halfway
   * springs back to exactly where it was. A close that only happens on release,
   * with nothing moving until then, is a gesture you have to be told about.
   *
   * TOUCH ONLY. A mouse has the X, the arrows and Escape; hijacking a
   * mouse-drag here would fight text selection for no gain.
   */
  const down = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return
    touch.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }
    setPaused(true)
  }

  const move = (e: React.PointerEvent) => {
    const t = touch.current
    if (!t || e.pointerId !== t.id) return
    const dy = e.clientY - t.y
    const dx = e.clientX - t.x
    if (!t.moved && Math.abs(dy) < GESTURE && Math.abs(dx) < GESTURE) return
    if (!t.moved) {
      if (Math.abs(dx) > Math.abs(dy)) {
        // Sideways is not one of ours; give the gesture up so nothing sticks.
        touch.current = null
        setPaused(false)
        return
      }
      t.moved = true
      setSwiping(true)
    }
    // Upward travel is not shown — it opens the composer on release instead,
    // and dragging the picture off the top of the screen would imply it
    // dismisses that way too.
    setDrag(Math.max(0, dy))
  }

  const up = (e: React.PointerEvent) => {
    const t = touch.current
    touch.current = null
    setSwiping(false)
    if (!t || e.pointerId !== t.id) return
    const dy = e.clientY - t.y
    setDrag(0)
    if (!t.moved) {
      setPaused(false)
      return
    }
    if (dy > DISMISS) {
      onClose()
      return
    }
    if (dy < -GESTURE * 4) {
      // Up: the reply box, which is what "swipe up" means on every other reel.
      replyRef.current?.focus()
      return
    }
    setPaused(false)
  }

  const toggleLike = () => {
    if (!story) return
    const nextLiked = !liked
    setLiked(nextLiked)
    void markStorySeen(story.id, nextLiked)
  }

  /*
   * ONE COLUMN WIDTH FOR THE WHOLE REEL.
   *
   * The frame is 9:16 and centred; the header and the reply bar ran the full
   * width of the screen, so on a desktop the "Send message…" field was a
   * 1400px bar under a 400px photo. Instagram keeps all three the same width
   * because they are one card, and this is that width in one place rather
   * than three copies of the same calc.
   */
  const COLUMN = 'mx-auto w-full max-w-[min(100%,calc((100vh-13rem)*9/16))]'

  return createPortal(
    <div
      className="ct-animate-fade fixed inset-0 z-[70] flex flex-col bg-black"
      role="dialog"
      aria-modal="true"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      /* A drag that ended past the tap threshold must not also fire the tap
         zone underneath it: swiping down would close the reel AND advance it
         on the way out. Caught on the way in, before the half-screen button
         ever sees it. */
      onClickCapture={(e) => {
        if (drag > GESTURE) {
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      style={{
        transform: drag ? `translate3d(0, ${drag}px, 0) scale(${Math.max(0.88, 1 - drag / 1400)})` : undefined,
        opacity: drag ? Math.max(0.35, 1 - drag / 420) : undefined,
        transition: swiping ? 'none' : 'transform 240ms cubic-bezier(0.32,0.72,0,1), opacity 240ms ease',
        borderRadius: drag ? 18 : undefined,
        touchAction: 'none',
      }}
    >
      {/* Segments. One per story, filled behind you, timing the current one. */}
      <div className={cn('flex gap-[3px] px-2 pt-[calc(0.5rem+env(safe-area-inset-top))]', COLUMN)}>
        {(stories ?? [{ id: 'x' } as Story]).map((s, n) => (
          <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            {/*
              HOLDING FREEZES THE BAR WHERE IT IS. It used to jump to full on
              pause, which reads as "finished" — the exact opposite of what
              holding the screen means — and then restarted from zero on
              release. `animation-play-state` stops it mid-sweep instead, and
              the duration is what is LEFT rather than the full segment, so the
              bar and the timer are the same number.
            */}
            <span
              className={cn(
                'block h-full bg-white',
                n < i && 'w-full',
                // Under reduced motion the bar is simply full for the story
                // you are on: a timer you cannot see is better than one that
                // snaps to the end and implies it already finished.
                n === i && (reduced ? 'w-full' : 'ct-story-progress'),
              )}
              style={
                n === i && !reduced
                  ? {
                      animationDuration: `${left}ms`,
                      animationPlayState: paused ? 'paused' : 'running',
                    }
                  : undefined
              }
            />
          </span>
        ))}
      </div>

      {/* Who, and when. */}
      <div className={cn('flex items-center gap-2.5 px-3 py-3', COLUMN)}>
        <Link
          to={`/app/community/org/${ring.handle.replace(/^@/, '')}`}
          onClick={onClose}
          className="flex min-w-0 items-center gap-2.5"
        >
          {ring.logo ? (
            <img src={ring.logo} alt="" className="size-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white"
              style={{ background: ring.color ?? '#4b5563' }}
            >
              {(ring.glyph || ring.name.slice(0, 2)).toUpperCase()}
            </span>
          )}
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-[13.5px] font-semibold text-white">
              {ring.handle.replace(/^@/, '')}
            </span>
            {ring.verified && <VerifiedBadge size={13} />}
          </span>
        </Link>
        {story && (
          <span className="shrink-0 text-[12px] text-white/60">
            {storyAge(story.createdAt, now())}
          </span>
        )}
        <span className="flex-1" />
        {/* Follow, then the overflow, then close — the reference's order, and
            the one every reel uses. Outlined rather than filled: on top of a
            photograph a solid accent button is the loudest thing on screen and
            it is not the thing you came to look at. */}
        {!isFollowing(ring.handle) && (
          <button
            type="button"
            onClick={() => toggleFollow(ring.handle)}
            className="shrink-0 rounded-lg border border-white/60 px-2.5 py-1 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-white/15 active:scale-95"
          >
            Follow
          </button>
        )}
        <DropdownMenu
          ariaLabel="Story options"
          triggerClassName="grid size-8 shrink-0 place-items-center rounded-full text-white/80 hover:text-white"
          items={[
            {
              id: 'pause',
              label: paused ? 'Play' : 'Pause',
              icon: paused ? Play : Pause,
              onSelect: () => setPaused((v) => !v),
            },
            {
              id: 'mute',
              label: `Stop suggesting ${ring.handle.replace(/^@/, '')}`,
              icon: EyeOff,
              onSelect: () => {
                muteOrg(ring.orgId)
                onClose()
              },
            },
            {
              id: 'report',
              label: 'Report',
              icon: Flag,
              danger: true,
              separated: true,
              onSelect: () => {
                onClose()
                navigate('/app/community?support=1')
              },
            },
          ]}
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 shrink-0 place-items-center rounded-full text-white/80 transition-transform duration-150 hover:text-white active:scale-90"
        >
          <X size={20} aria-hidden />
        </button>
      </div>

      {/*
        THE FRAME IS 9:16, THE SAME SHAPE THE COMPOSER DRAWS ON.
        Overlay positions are fractions OF THE FRAME, so if this box were
        simply "whatever is left of the screen" a caption placed over
        somebody's face would slide off it on a different aspect ratio. The
        photo is `object-contain` inside that frame with a blurred copy of
        itself behind, so a landscape picture is neither cropped nor sitting
        on a bare black slab.
      */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/*
          THE CLUBS EITHER SIDE, on a wide screen.
          A reel on a desktop is a tall card in the middle of a black field,
          and without the neighbours there is nothing to say that tapping the
          right side goes anywhere — the peek IS the affordance, which is why
          the reference has it. Hidden under `lg`, where the card already fills
          the screen and a card behind it would only be in the way.
        */}
        <Peek ring={rings[ringIndex - 1]} side="left" onOpen={prev} />
        <Peek ring={rings[ringIndex + 1]} side="right" onOpen={next} />
        {story ? (
          <div
            /* Keyed on the story so a new one fades in rather than swapping
               between frames — advancing used to be an instant cut, which is
               what made it feel snappy in the bad sense. */
            key={story.id}
            className="ct-story-in relative aspect-[9/16] max-h-full w-full max-w-[min(100%,calc((100vh-13rem)*9/16))] overflow-hidden [container-type:inline-size]"
          >
            <img
              src={story.imageUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
            />
            <img
              src={story.imageUrl}
              alt={story.caption ?? ''}
              className="relative size-full object-contain"
            />
            {story.overlays.map((o, n) => (
              <span
                key={n}
                className={cn(
                  // Sized as a fraction of the FRAME's width, like the composer, so text
                  // covers the same part of the photo on every screen.
                  'pointer-events-none absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 text-center text-[6.6cqw] leading-tight break-words whitespace-pre-wrap',
                  fontClass(o.font),
                  animClass(o.anim),
                  o.chip && 'rounded-lg bg-black/55 px-3 py-1.5 backdrop-blur-sm',
                )}
                style={{ left: `${o.x * 100}%`, top: `${o.y * 100}%`, color: o.color }}
              >
                {o.text}
              </span>
            ))}

            {/* Halves of the frame step the reel, the way everyone expects. */}
            <button
              type="button"
              aria-label="Previous"
              onClick={prev}
              className="absolute inset-y-0 left-0 w-1/3"
            />
            <button type="button" aria-label="Next" onClick={next} className="absolute inset-y-0 right-0 w-1/3" />
            <span className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 items-center justify-center text-white/40 sm:flex">
              <ChevronLeft size={22} aria-hidden />
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 hidden w-10 items-center justify-center text-white/40 sm:flex">
              <ChevronRight size={22} aria-hidden />
            </span>
          </div>
        ) : (
          <div className="grid size-full place-items-center text-[13px] text-white/60">
            {stories ? 'Nothing here any more.' : 'Loading…'}
          </div>
        )}
      </div>

      {/* Caption, place and the club's own link, under the frame where they do
          not sit on top of the picture. */}
      {story && (story.caption || story.place || story.linkUrl) && (
        <div className="px-4 pb-1 text-[13px] text-white/85">
          {story.caption && <p className="whitespace-pre-wrap">{story.caption}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {story.place && (
              <span className="inline-flex items-center gap-1 text-[12px] text-white/70">
                <MapPin size={12} aria-hidden />
                {story.place}
              </span>
            )}
            {story.linkUrl && (
              <a
                href={story.linkUrl}
                target="_blank"
                rel="noreferrer noopener nofollow ugc"
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-[12px] font-medium text-white hover:bg-white/25"
              >
                Open link
              </a>
            )}
          </div>
        </div>
      )}

      {/* Reply, like, share — the three things you can do to a story.
          `touch-auto` puts native touch behaviour back for the field: the
          gesture layer above owns the picture, not the keyboard. */}
      <div
        className={cn(
          'flex touch-auto items-center gap-2 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
          COLUMN,
        )}
      >
        <input
          ref={replyRef}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onFocus={() => setPaused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send()
          }}
          placeholder={sent ? 'Sent' : 'Send message…'}
          aria-label="Reply to this story"
          className="min-w-0 flex-1 rounded-full border border-white/30 bg-transparent px-4 py-2.5 text-[13.5px] text-white placeholder:text-white/50 focus:border-white/70 focus:outline-none"
        />
        {reply.trim() ? (
          <button
            type="button"
            onClick={() => void send()}
            aria-label="Send"
            className="grid size-10 shrink-0 place-items-center rounded-full text-white hover:bg-white/15"
          >
            <Send size={19} aria-hidden />
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleLike}
              aria-pressed={liked}
              aria-label={liked ? 'Liked' : 'Like'}
              className="grid size-10 shrink-0 place-items-center rounded-full text-white hover:bg-white/15"
            >
              <Heart size={21} className={cn(liked && 'fill-[#ff3b5c] text-[#ff3b5c]')} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(true)
                setSharing(true)
              }}
              aria-label="Send to someone"
              className="grid size-10 shrink-0 place-items-center rounded-full text-white hover:bg-white/15"
            >
              <Send size={19} aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* Views, to the club only. A count, never a list. */}
      {story && story.views > 0 && (
        <p className="px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] text-[11px] text-white/45">
          <Eye size={11} className="mr-1 inline" aria-hidden />
          {story.views} {story.views === 1 ? 'view' : 'views'}
        </p>
      )}

      {sharing && story && (
        <ShareSheet
          title={`${ring.handle.replace(/^@/, '')}'s story`}
          link={`${window.location.origin}/app/community/org/${ring.handle.replace(/^@/, '')}`}
          onClose={() => {
            setSharing(false)
            setPaused(false)
          }}
        />
      )}
    </div>,
    document.body,
  )
}

/**
 * A neighbouring club's reel, shown small at the edge.
 *
 * It is DECORATION PLUS A SHORTCUT, not a control you are expected to find:
 * the tap zones on the story itself already move between reels, and this says
 * what is on the other side of them. Absent when there is no neighbour rather
 * than rendered empty, so the middle of the reel is never off-centre for a
 * card that is not there.
 */
function Peek({
  ring,
  side,
  onOpen,
}: {
  ring: StoryRing | undefined
  side: 'left' | 'right'
  onOpen: () => void
}) {
  if (!ring) return null
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${side === 'left' ? 'Previous' : 'Next'}: ${ring.name}`}
      className={cn(
        'absolute top-1/2 hidden w-[14vw] max-w-[180px] -translate-y-1/2 overflow-hidden rounded-xl',
        'opacity-60 transition-opacity duration-200 hover:opacity-90 lg:block',
        side === 'left' ? 'right-[calc(50%+((100vh-13rem)*9/16/2)+16px)]' : 'left-[calc(50%+((100vh-13rem)*9/16/2)+16px)]',
      )}
    >
      <span className="relative block aspect-[9/16] bg-surface-2">
        {ring.cover && (
          <img src={ring.cover} alt="" className="absolute inset-0 size-full object-cover" />
        )}
        {/* Dimmed and captioned, so the peek reads as a neighbour rather than
            as a second story competing with the one you are watching. */}
        <span className="absolute inset-0 bg-black/45" />
        <span className="absolute inset-x-2 bottom-2 flex flex-col items-center gap-1">
          {ring.logo ? (
            <img src={ring.logo} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span
              className="grid size-8 place-items-center rounded-full text-[11px] font-semibold text-white"
              style={{ background: ring.color ?? '#4b5563' }}
            >
              {(ring.glyph || ring.name.slice(0, 2)).toUpperCase()}
            </span>
          )}
          <span className="w-full truncate text-center text-[11px] font-medium text-white">
            {ring.handle.replace(/^@/, '')}
          </span>
        </span>
      </span>
    </button>
  )
}
