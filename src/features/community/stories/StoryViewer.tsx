import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, Heart, MapPin, Pause, Send, X } from 'lucide-react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { sendMessage } from '@/lib/social'
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
 * REPLIES ARE ORDINARY DMs. "Send message" writes to `messages`, so the
 * recipient's DM policy, blocks and the stranger limits all apply with no
 * second path to keep in step.
 */
export function StoryViewer({
  ring,
  onClose,
  onSeen,
}: {
  ring: StoryRing
  onClose: () => void
  /** Told when a story is marked seen so the row can drop its gradient. */
  onSeen?: () => void
}) {
  const reduced = usePrefersReducedMotion()
  const [stories, setStories] = useState<Story[] | null>(null)
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reply, setReply] = useState('')
  const [sent, setSent] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [liked, setLiked] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    let alive = true
    void loadStoryReel(ring.orgId).then((rows) => {
      if (!alive) return
      setStories(rows)
      // Start on the first unwatched one, the way a reel resumes.
      const first = rows.findIndex((s) => !s.seen)
      setI(first === -1 ? 0 : first)
    })
    return () => {
      alive = false
    }
  }, [ring.orgId])

  const story = stories?.[i]

  const next = useCallback(() => {
    setI((n) => {
      if (!stories) return n
      if (n + 1 >= stories.length) {
        onClose()
        return n
      }
      return n + 1
    })
  }, [stories, onClose])

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

  // The advance. Paused while you hold the screen or type a reply, because
  // losing a story mid-sentence is the single most annoying thing this
  // interaction can do.
  useEffect(() => {
    if (!story || paused) return
    timer.current = window.setTimeout(next, SEGMENT_MS)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [story, paused, next])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose, next])

  const send = async () => {
    const body = reply.trim()
    if (!body || !story) return
    setReply('')
    // Named so the recipient knows what it answers — a bare line arriving out
    // of nowhere is the reason story replies feel like spam elsewhere.
    const err = await sendMessageToOrgOwner(ring, `Replying to your story: ${body}`)
    setSent(!err)
    if (err) setReply(body)
  }

  const toggleLike = () => {
    if (!story) return
    const nextLiked = !liked
    setLiked(nextLiked)
    void markStorySeen(story.id, nextLiked)
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black" role="dialog" aria-modal="true">
      {/* Segments. One per story, filled behind you, timing the current one. */}
      <div className="flex gap-1 px-3 pt-3">
        {(stories ?? [{ id: 'x' } as Story]).map((s, n) => (
          <span key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <span
              className={cn(
                'block h-full bg-white',
                n < i && 'w-full',
                // Under reduced motion the bar is simply full for the story
                // you are on: a timer you cannot see is better than one that
                // snaps to the end and implies it already finished.
                n === i && (reduced || paused ? 'w-full' : 'ct-story-progress'),
              )}
              style={
                n === i && !reduced && !paused
                  ? { animationDuration: `${SEGMENT_MS}ms` }
                  : undefined
              }
            />
          </span>
        ))}
      </div>

      {/* Who, and when. */}
      <div className="flex items-center gap-2.5 px-3 py-3">
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
        <button
          type="button"
          onClick={() => setPaused((v) => !v)}
          aria-label={paused ? 'Play' : 'Pause'}
          className="grid size-8 place-items-center rounded-full text-white/80 hover:text-white"
        >
          {paused ? <ChevronRight size={18} aria-hidden /> : <Pause size={17} aria-hidden />}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 place-items-center rounded-full text-white/80 hover:text-white"
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
        {story ? (
          <div className="relative aspect-[9/16] max-h-full w-full max-w-[min(100%,calc((100vh-13rem)*9/16))] overflow-hidden">
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
                  'pointer-events-none absolute max-w-[82%] -translate-x-1/2 -translate-y-1/2 text-center text-[22px] leading-tight break-words whitespace-pre-wrap sm:text-[28px]',
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
              onClick={() => setI((n) => Math.max(0, n - 1))}
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

      {/* Reply, like, share — the three things you can do to a story. */}
      <div className="flex items-center gap-2 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <input
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

/** A story reply goes to the account that runs the club, because an org has no
 *  inbox of its own yet. Honest about the limit rather than dropping it. */
async function sendMessageToOrgOwner(ring: StoryRing, body: string): Promise<string | null> {
  const { ownerIdForOrg } = await import('@/lib/org-owner')
  const owner = await ownerIdForOrg(ring.orgId)
  if (!owner) return 'That club has no one to receive messages yet.'
  return sendMessage(owner, body)
}
