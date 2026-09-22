import { useEffect, useState } from 'react'
import { Images, Play, Repeat2 } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { ModalShell } from '@/command/ModalShell'
import { Skeleton } from '@/components/ui/Skeleton'
import { loadPosts, loadReposts, type FeedPost, type RepostRow } from '@/lib/social-posts'
import type { CampusEvent } from '@/data/community'
import { useCommunity } from '../useCommunity'
import { EventMedia } from '../EventMedia'
import { PostCard } from './PostCard'

/**
 * What this account has passed on — the second tab on every profile.
 *
 * IT IS A GRID NOW, which is the reference's answer and the right one for a
 * different reason than "Instagram does it". A profile tab is a CONTACT SHEET:
 * you are scanning for the one you remember, and a stack of full-width cards
 * shows you three items per screen with the caption, the actions and the
 * comment count of each — all of which belong in the feed, where you are
 * reading, and none of which help you find something. Nine tiles per screen
 * answers "what is in here" in one look, and a tap gives you the whole thing.
 *
 * ONE TAB FOR BOTH KINDS. An event and a post are both "a thing somebody else
 * published that I wanted on my page", and splitting them would give most
 * people two tabs with one item between them.
 *
 * A TARGET THAT NO LONGER EXISTS IS SKIPPED, not drawn as a placeholder. The
 * club deleted it; showing a grey box that says so is telling you about
 * somebody else's housekeeping.
 */
export function RepostsTab({
  handle,
  isOrg = false,
  onOpenEvent,
}: {
  handle: string
  isOrg?: boolean
  onOpenEvent: (id: string) => void
}) {
  const { events } = useCommunity()
  const [rows, setRows] = useState<RepostRow[] | null>(null)
  const [posts, setPosts] = useState<Map<string, FeedPost>>(new Map())
  /** The post you tapped. Opened over the grid rather than navigated to, so
   *  closing it puts you back at the same scroll position in the same tab. */
  const [open, setOpen] = useState<FeedPost | null>(null)

  useEffect(() => {
    let alive = true
    void loadReposts(handle, isOrg)
      .then(async (r) => {
        if (!alive) return
        setRows(r)
        if (r.some((x) => x.kind === 'post')) {
          // One read for the page rather than one per row. The feed function
          // already returns counts and my own like state, so a reposted post
          // behaves exactly as it does in the feed.
          const all = await loadPosts({ limit: 50 })
          if (alive) setPosts(new Map(all.map((p) => [p.id, p])))
        }
      })
      .catch(() => alive && setRows([]))
    return () => {
      alive = false
    }
  }, [handle, isOrg])

  if (rows === null) return <GridSkeleton />

  const resolved = rows
    .map((r) =>
      r.kind === 'event'
        ? { id: r.id, event: events.find((e) => e.id === r.targetId) }
        : { id: r.id, post: posts.get(r.targetId) },
    )
    .filter((x) => ('event' in x ? x.event : x.post))

  if (resolved.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center">
        <Mascot mood="resting" size="sm" soft className="text-accent" />
        <p className="text-[13.5px] font-medium text-fg">Nothing reposted yet</p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
          <Repeat2 size={12} className="mr-1 inline" aria-hidden />
          The repost button on an event or a post puts it here.
        </p>
      </div>
    )
  }

  return (
    <>
      {/*
        Three across, hairline gaps, edge to edge on a phone — the contact
        sheet, not a list of cards.

        `-mx-4` because that is the gutter of the container this renders in
        most often (Community's own `px-4`). The standalone `/@handle` page
        pads by 20, so there it insets by 4px rather than bleeding past the
        screen — which is the right way round: a grid 8px wider than the
        viewport is a horizontal scrollbar, and 4px of inset is invisible.
      */}
      <div className="-mx-4 mt-0.5 grid grid-cols-3 gap-0.5 sm:mx-0 sm:gap-1">
        {resolved.map((x) =>
          'event' in x && x.event ? (
            <Tile key={x.id} label={x.event.title} onOpen={() => onOpenEvent(x.event!.id)}>
              <EventTileMedia event={x.event} />
            </Tile>
          ) : 'post' in x && x.post ? (
            <Tile key={x.id} label={x.post.caption || 'Post'} onOpen={() => setOpen(x.post!)}>
              <PostTileMedia post={x.post} />
            </Tile>
          ) : null,
        )}
      </div>

      {open && (
        <ModalShell label="Post" onClose={() => setOpen(null)} widthClass="sm:max-w-md">
          <div className="max-h-[80vh] overflow-y-auto px-4 pb-4">
            <PostCard post={open} />
          </div>
        </ModalShell>
      )}
    </>
  )
}

function Tile({
  children,
  label,
  onOpen,
}: {
  children: React.ReactNode
  label: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="relative aspect-square overflow-hidden bg-surface-2 transition-opacity duration-150 active:opacity-70 sm:rounded-sm"
    >
      {children}
    </button>
  )
}

/** A post's first frame, with the corner glyph that says there is more to it —
 *  a stack for a carousel, a triangle for a clip, exactly as the reference
 *  marks them. Both are information: a square with neither is one picture. */
function PostTileMedia({ post }: { post: FeedPost }) {
  const first = post.media[0]
  if (!first) {
    return (
      <span className="flex size-full items-center justify-center px-2 text-center text-[11px] leading-snug text-subtle">
        {post.caption.slice(0, 60)}
      </span>
    )
  }
  return (
    <>
      {first.kind === 'video' ? (
        <video src={first.url} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : (
        <img src={first.url} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
      )}
      {(first.kind === 'video' || post.media.length > 1) && (
        <span className="absolute top-1.5 right-1.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
          {first.kind === 'video' ? (
            <Play size={13} className="fill-current" aria-hidden />
          ) : (
            <Images size={13} aria-hidden />
          )}
        </span>
      )}
    </>
  )
}

/** An event has no photograph of its own half the time, so it reuses the same
 *  branded block the feed draws — never an empty square. */
function EventTileMedia({ event }: { event: CampusEvent }) {
  return <EventMedia event={event} variant="banner" className="size-full !rounded-none" />
}

function GridSkeleton() {
  return (
    <div className="-mx-4 mt-0.5 grid grid-cols-3 gap-0.5 sm:mx-0 sm:gap-1" aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="aspect-square rounded-none sm:rounded-sm" />
      ))}
    </div>
  )
}
