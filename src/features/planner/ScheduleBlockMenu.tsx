import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye, EyeOff, Info, Pin, PinOff, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Right-click a class on the week.
 *
 * The three things you want to do to a block you are looking at are settle it,
 * get it out of the way, or find out what it actually is — and all three used
 * to live only in the list beside the grid, which means finding the row that
 * matches the rectangle you are pointing at. A context menu removes that step
 * entirely: the thing under the cursor IS the thing being acted on.
 *
 * Positioned at the pointer and flipped back inside the viewport, because a
 * menu that opens half off-screen is worse than no menu.
 */
export interface BlockMenuTarget {
  code: string
  classNumber: string
  at: { x: number; y: number }
}

const WIDTH = 194
/** Four items plus a separator. Estimated so the flip can happen on open. */
const HEIGHT = 168

export function ScheduleBlockMenu({
  target,
  pinned,
  hidden,
  onPin,
  onHide,
  onRemove,
  onDetails,
  onClose,
}: {
  target: BlockMenuTarget
  pinned: boolean
  hidden: boolean
  onPin: () => void
  onHide: () => void
  onRemove: () => void
  onDetails: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Measured once from the pointer, not tracked: the menu belongs to the click
  // that opened it, and a menu that slides around while you read it is a menu
  // you misclick.
  const [pos] = useState(() => ({
    left: Math.min(target.at.x, window.innerWidth - WIDTH - 8),
    top:
      target.at.y + HEIGHT > window.innerHeight
        ? Math.max(8, target.at.y - HEIGHT)
        : target.at.y,
  }))

  useEffect(() => {
    // The menu is portaled to <body>, so an outside-click test that only knows
    // about the trigger counts the menu's own buttons as outside — mousedown
    // closes it, React unmounts it, and the click never lands. Its own ref is
    // the whole fix, and it is the third time this has bitten in this feature.
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={`${target.code} options`}
      style={{ position: 'fixed', left: pos.left, top: pos.top, width: WIDTH }}
      className="z-[70] overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-lg"
    >
      <p className="truncate px-3 py-1 text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
        {target.code}
      </p>
      <Item
        icon={pinned ? PinOff : Pin}
        label={pinned ? 'Unpin' : 'Pin this one'}
        hint={pinned ? undefined : 'Keeps this exact slot when you generate'}
        onSelect={run(onPin)}
      />
      <Item
        icon={hidden ? Eye : EyeOff}
        label={hidden ? 'Show on the week' : 'Hide from the week'}
        hint={hidden ? undefined : 'Stays in the list — nothing is removed'}
        onSelect={run(onHide)}
      />
      <Item icon={Info} label="Details" onSelect={run(onDetails)} />
      <div className="my-1 border-t border-border" />
      <Item icon={Trash2} label="Remove" danger onSelect={run(onRemove)} />
    </div>,
    document.body,
  )
}

function Item({
  icon: Icon,
  label,
  hint,
  danger,
  onSelect,
}: {
  icon: typeof Pin
  label: string
  hint?: string
  danger?: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors duration-150',
        danger ? 'text-danger hover:bg-danger/10' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon size={13} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        {label}
        {hint && <span className="block text-[10.5px] leading-snug text-subtle">{hint}</span>}
      </span>
    </button>
  )
}
