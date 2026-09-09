import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Link2, MessageSquare, MoreVertical, Rss, UserRound, UserX } from 'lucide-react'
import { removeFriend, unfollowUser } from '@/lib/social'
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
  /** Present when you are connected — enables Message and Disconnect. */
  friendshipId?: string
  /** Present when you follow them — enables Unfollow. */
  following?: boolean
  at: { x: number; y: number }
}

const WIDTH = 210
const HEIGHT = 190

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
      className="ct-animate-pop z-[70] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
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
      {target.friendshipId && onMessage && (
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

      {(target.following || target.friendshipId) && <div className="my-1 border-t border-border" />}

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
      {target.friendshipId && (
        <Item
          icon={UserX}
          label="Remove connection"
          danger
          onSelect={() => {
            void removeFriend(target.friendshipId as string).then(() => onChanged?.())
            onClose()
          }}
        />
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
      className="grid size-7 shrink-0 place-items-center rounded-lg text-subtle opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-2 hover:text-fg"
    >
      <MoreVertical size={14} aria-hidden />
    </button>
  )
}
