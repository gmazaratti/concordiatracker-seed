import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ban, Check, Link2, MessageSquare, MoreVertical, Rss, UserRound } from 'lucide-react'
import { blockUser, haveIBlocked, unblockUser, unfollowUser } from '@/lib/social'
import { cn } from '@/lib/cn'

/**
 * The actions that belong to a person, reachable two ways.
 *
 * Right-click, because that is what people try on a row and it costs nothing to
 * honour; and a ⋮ that appears on hover, because right-click is undiscoverable
 * and does not exist on a phone. Same menu either way, so there is one list of
 * actions to keep true rather than two.
 *
 * Portaled and positioned at the pointer, with its own ref in the outside-click
 * check — a portaled menu is not inside its trigger, so testing only the
 * trigger counts the menu's own buttons as "outside" and the click never lands.
 */
export interface PersonTarget {
  handle: string
  name?: string | null
  /**
   * Mutual follow. It no longer gates Message — anyone may write to anyone,
   * under the limits in db/social_follow_model.sql — so this only decides
   * whether opening the EXISTING thread makes sense from this row.
   */
  connected?: boolean
  /** Present when you follow them — enables Unfollow. */
  following?: boolean
  at: { x: number; y: number }
}

const WIDTH = 210
// Grows with the menu: the flip-up calculation uses it, and an undersized
// estimate puts the last item off the bottom of the screen.
const HEIGHT = 248

export function PersonMenu({
  target,
  onMessage,
  onChanged,
  onClose,
}: {
  target: PersonTarget
  onMessage?: () => void
  onChanged?: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  // Blocking is the one irreversible-feeling action here, so it asks twice.
  // The second click is the confirmation; there is no dialog, because a
  // dialog over a context menu is two layers to dismiss.
  const [confirmBlock, setConfirmBlock] = useState(false)
  const [blocked, setBlocked] = useState<boolean | null>(null)
  // A block that quietly does nothing is the worst version of this feature:
  // you would believe you were no longer reachable. Say so instead.
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    void haveIBlocked(target.handle).then((b) => {
      if (alive) setBlocked(b)
    })
    return () => {
      alive = false
    }
  }, [target.handle])
  const [pos] = useState(() => ({
    left: Math.min(target.at.x, window.innerWidth - WIDTH - 8),
    top:
      target.at.y + HEIGHT > window.innerHeight
        ? Math.max(8, target.at.y - HEIGHT)
        : target.at.y,
  }))

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  const url = `${window.location.origin}/@${target.handle}`

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`${target.name ?? target.handle} options`}
      style={{ position: 'fixed', left: pos.left, top: pos.top, width: WIDTH }}
      className="ct-animate-pop z-[200] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
    >
      <p className="truncate px-3 py-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
        {target.name ?? `@${target.handle}`}
      </p>

      <Item
        icon={UserRound}
        label="View profile"
        onSelect={() => {
          window.location.href = `/@${target.handle}`
          onClose()
        }}
      />
      {target.connected && onMessage && (
        <Item
          icon={MessageSquare}
          label="Message"
          onSelect={() => {
            onMessage()
            onClose()
          }}
        />
      )}
      <Item
        icon={copied ? Check : Link2}
        label={copied ? 'Link copied' : 'Copy profile link'}
        onSelect={() => {
          // Left open on purpose: the label changing to "Link copied" is the
          // only confirmation there is, and closing instantly hides it.
          navigator.clipboard?.writeText(url).then(
            () => setCopied(true),
            () => setCopied(false),
          )
        }}
      />

      {target.following && <div className="my-1 border-t border-border" />}

      {target.following && (
        <Item
          icon={Rss}
          label="Unfollow"
          onSelect={() => {
            void unfollowUser(target.handle).then(() => onChanged?.())
            onClose()
          }}
        />
      )}
      {/* Rendered only once we know which way round it goes — showing "Block"
          to someone who has already blocked them, and silently doing nothing
          when they click it, is worse than a moment with no row. */}
      {blocked === false && (
        <>
          {!target.following && <div className="my-1 border-t border-border" />}
          <Item
            icon={Ban}
            label={confirmBlock ? 'Block? Are you sure?' : 'Block'}
            danger
            onSelect={() => {
              if (!confirmBlock) {
                setConfirmBlock(true)
                return
              }
              void blockUser(target.handle).then((ok) => {
                if (!ok) {
                  setFailed(true)
                  return
                }
                onChanged?.()
                onClose()
              })
            }}
          />
        </>
      )}
      {blocked === true && (
        <>
          <div className="my-1 border-t border-border" />
          <Item
            icon={Ban}
            label="Unblock"
            onSelect={() => {
              void unblockUser(target.handle).then((ok) => {
                if (!ok) {
                  setFailed(true)
                  return
                }
                onChanged?.()
                onClose()
              })
            }}
          />
        </>
      )}

      {failed && (
        <p className="px-3 pt-1 pb-1.5 text-[11px] leading-snug text-danger">
          That didn&rsquo;t go through. Nothing changed.
        </p>
      )}
    </div>,
    document.body,
  )
}

function Item({
  icon: Icon,
  label,
  danger,
  onSelect,
}: {
  icon: typeof UserRound
  label: string
  danger?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors duration-150',
        danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon size={13} className="shrink-0" aria-hidden />
      {label}
    </button>
  )
}

/** The ⋮ that appears on hover. Its own component so every row that wants one
 *  gets the same target size and the same keyboard behaviour. */
export function PersonMenuButton({ onOpen }: { onOpen: (at: { x: number; y: number }) => void }) {
  return (
    <button
      type="button"
      aria-label="More actions"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        const r = e.currentTarget.getBoundingClientRect()
        onOpen({ x: r.right - 190, y: r.bottom + 4 })
      }}
      /* Visible by default, hidden until hover ONLY on devices that hover.
         It was `opacity-0` with a group-hover reveal, which on a phone means it
         is never shown and never reachable — and long-press on iOS opens the
         system callout, not our menu. So on touch it is simply always there. */
      className="grid size-7 shrink-0 place-items-center rounded-lg text-subtle transition-opacity duration-150 focus-visible:opacity-100 hover:bg-surface-2 hover:text-fg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
    >
      <MoreVertical size={14} aria-hidden />
    </button>
  )
}
