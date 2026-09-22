import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Trash2, X } from 'lucide-react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'

/** Past this, letting go opens the button. */
const REVEAL = 72
/** Past this, letting go deletes — no confirmation, because there is an
 *  undo and the row is one line. */
const COMMIT = 168
/** Until the finger has moved this far, the gesture might still be a scroll. */
const LOCK = 8
/** The row collapsing after it is gone. */
const EXIT_MS = 200

/**
 * Swipe a row away.
 *
 * TWO DISTANCES, WHICH IS THE WHOLE INTERACTION. A short pull parks the row
 * open with a Delete button, so the gesture is discoverable and reversible; a
 * long pull commits on release, so somebody clearing ten of these does not
 * have to aim at a button ten times. Both are what every list of this shape
 * does, and doing only one of them makes the other feel missing.
 *
 * DELIBERATELY NOT `SwipeRow`, which Today uses. That one's contract is
 * "right finishes it, left opens a tray of actions" and it NEVER commits on a
 * long pull — because its left-hand tray holds Delete, and a destructive
 * action you can trigger by brushing the screen is one that happens in a
 * pocket. Here the row is a notification: losing one costs nothing, there is
 * an undo, and the commit is the point. One component with a mode flag would
 * have hidden exactly that difference.
 *
 * TOUCH AND PEN ONLY. On a desktop a horizontal drag across a line of text is
 * selection, so the mouse gets the visible button instead — revealed on hover
 * where there is a hover device at all.
 *
 * THE RELEASE READS A REF, not state: a flick can deliver its last
 * `pointermove` and its `pointerup` inside one task, and React has not
 * re-rendered in between, so reading state would decide using a position from
 * two moves ago. Same lesson as SwipeRow.
 */
export function SwipeToDelete({
  children,
  onDelete,
  label,
  className,
}: {
  children: ReactNode
  onDelete: () => void
  /** For the button's accessible name — "Dismiss <this notification>". */
  label: string
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [open, setOpen] = useState(false)
  const [gone, setGone] = useState(false)
  const dxRef = useRef(0)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<'none' | 'x' | 'y'>('none')

  const put = (v: number) => {
    dxRef.current = v
    setDx(v)
  }

  // Touching anything else puts it back, the way every list that does this
  // behaves. Pointerdown rather than click, so it closes before whatever is
  // underneath reacts.
  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      put(0)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const remove = () => {
    if (gone) return
    setGone(true)
    // The row collapses, THEN the caller removes it. Deleting first makes the
    // list jump under your thumb while the next row is still arriving.
    window.setTimeout(onDelete, reduced ? 0 : EXIT_MS)
  }

  const down = (e: React.PointerEvent) => {
    if (gone || e.pointerType === 'mouse') return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }
    axis.current = 'none'
  }

  const move = (e: React.PointerEvent) => {
    const s = start.current
    if (!s || e.pointerId !== s.id) return
    const mx = e.clientX - s.x
    const my = e.clientY - s.y

    if (axis.current === 'none') {
      if (Math.abs(mx) < LOCK && Math.abs(my) < LOCK) return
      axis.current = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'
      if (axis.current === 'x') {
        try {
          e.currentTarget.setPointerCapture(s.id)
        } catch {
          /* the pointer may already be gone; losing capture costs the drag,
             never correctness */
        }
        setDragging(true)
      }
    }
    if (axis.current !== 'x') return

    // Left only. Pulling right from closed does nothing, and past the commit
    // point it resists so the row cannot be dragged off into space.
    let next = open ? mx - REVEAL : mx
    if (next > 0) next = 0
    if (next < -COMMIT) next = -COMMIT + (next + COMMIT) * 0.3
    put(next)
  }

  const up = () => {
    const wasDragging = axis.current === 'x'
    start.current = null
    axis.current = 'none'
    if (!wasDragging) return
    setDragging(false)
    const travelled = -dxRef.current
    if (travelled >= COMMIT) {
      put(0)
      setOpen(false)
      remove()
      return
    }
    if (travelled >= REVEAL) {
      setOpen(true)
      put(-REVEAL)
      return
    }
    setOpen(false)
    put(0)
  }

  const armed = -dx >= COMMIT

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        !gone && 'transition-none',
        gone && 'pointer-events-none',
        className,
      )}
      style={
        gone
          ? { maxHeight: 0, opacity: 0, transition: reduced ? 'none' : `all ${EXIT_MS}ms ease-out` }
          : undefined
      }
    >
      {/* Behind: what letting go will do. It fills as you pull and turns solid
          at the commit point, so the outcome is visible before you commit to
          it rather than announced afterwards. */}
      {dx < 0 && (
        <div
          className={cn(
            'absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-4 text-[12.5px] font-semibold transition-colors duration-150',
            armed ? 'bg-danger text-accent-contrast' : 'bg-danger/20 text-danger',
          )}
          style={{ width: Math.min(-dx, COMMIT + 40) }}
          aria-hidden
        >
          {-dx > 108 && <span className="truncate">{armed ? 'Release to delete' : 'Delete'}</span>}
          <Trash2 size={16} className="shrink-0" />
        </div>
      )}

      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ transform: `translate3d(${dx}px,0,0)` }}
        className={cn(
          'group/swipe relative flex items-center bg-canvas',
          // Off while the finger is down: the row must be where the finger
          // is, not easing towards it.
          !dragging && 'transition-transform duration-200 ease-out',
        )}
      >
        <div className="min-w-0 flex-1">{children}</div>

        {/*
          The same action, reachable without the gesture. Always present for a
          keyboard and a screen reader; visible on a pointer device only when
          the row is hovered, so a quiet list stays quiet.
        */}
        <button
          type="button"
          onClick={remove}
          aria-label={`Dismiss ${label}`}
          className={cn(
            'mr-2 grid size-7 shrink-0 place-items-center rounded-full text-subtle transition-[opacity,color] duration-150',
            'hover:bg-surface-2 hover:text-fg focus-visible:opacity-100',
            '[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/swipe:opacity-100',
          )}
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      {/* Parked open: the button the short pull revealed. */}
      {open && (
        <button
          type="button"
          onClick={remove}
          aria-label={`Delete ${label}`}
          className="absolute inset-y-0 right-0 grid w-[72px] place-items-center bg-danger text-accent-contrast"
        >
          <Trash2 size={17} aria-hidden />
        </button>
      )}
    </div>
  )
}
