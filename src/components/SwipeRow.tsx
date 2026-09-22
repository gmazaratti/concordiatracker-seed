import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface SwipeAction {
  id: string
  label: string
  icon: LucideIcon
  onSelect: () => void
  danger?: boolean
}

/** Past this the gesture has committed; below it the row springs back. */
const COMMIT = 92
/** How far the finger has to move before the row decides the gesture is
 *  horizontal at all. Below this the page is still allowed to scroll. */
const LOCK = 8
const ACTION_W = 68

/**
 * Swipe right to finish it, swipe left for what else you can do to it.
 *
 * TOUCH ONLY, and that is the same call `WeekGrid` made about dragging. On a
 * phone a horizontal drag across a list row means nothing else, so it is free
 * to mean this. On a desktop it is text selection, and the row already has a
 * visible checkbox and a visible menu — a mouse has no reason to guess.
 *
 * THE DIRECTION IS LOCKED IN THE FIRST 8 PIXELS. Until then nothing is
 * `preventDefault`ed and the list scrolls normally; once the movement is
 * clearly sideways the row takes the gesture and keeps it. Deciding per-frame
 * instead gives you a list that scrolls and slides at the same time, which is
 * the single most common way a gesture like this goes wrong.
 *
 * TRACKING IS 1:1 while the finger is down — no easing, no projection. The
 * transition is turned off during the drag and back on for the release, so the
 * spring-back is the only part that is animated. A row that lags behind the
 * finger feels broken in a way that is hard to name and easy to notice.
 *
 * NOTHING IS DESTRUCTIVE ON A SWIPE. Right marks done, which is undoable and
 * is what the checkbox already does. Delete lives in the left-hand tray behind
 * a deliberate tap, because a delete you can trigger by brushing the screen is
 * a delete that happens in a pocket.
 */
export function SwipeRow({
  children,
  onSwipeRight,
  rightIcon: RightIcon,
  rightLabel,
  actions,
  className,
  disabled,
}: {
  children: ReactNode
  onSwipeRight?: () => void
  rightIcon: LucideIcon
  rightLabel: string
  actions: SwipeAction[]
  className?: string
  disabled?: boolean
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [open, setOpen] = useState(false)
  const start = useRef<{ x: number; y: number; id: number } | null>(null)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  /*
   * The same number as `dx`, in a ref.
   *
   * `dx` is state because it drives the transform. But a flick can deliver its
   * last `pointermove` and its `pointerup` inside one task, and React has not
   * re-rendered in between — so the release handler would decide using the
   * position from two moves ago and let go of a gesture that had clearly
   * committed. The ref is what the decision reads; the state is what the
   * screen reads.
   */
  const dxRef = useRef(0)
  const put = (v: number) => {
    dxRef.current = v
    setDx(v)
  }

  const trayW = Math.min(actions.length, 3) * ACTION_W

  // An open tray closes when you touch anything else, the way every list that
  // does this behaves. Pointerdown rather than click so it closes before the
  // thing underneath reacts.
  useEffect(() => {
    if (!open) return
    const close = () => {
      setOpen(false)
      dxRef.current = 0
      setDx(0)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const down = (e: React.PointerEvent) => {
    if (disabled || e.pointerType !== 'touch') return
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
        // Held from here on, so leaving the row does not drop the gesture.
        // Capture can legitimately fail — the pointer may already be gone —
        // and losing it only costs us the drag, never correctness.
        try {
          e.currentTarget.setPointerCapture(s.id)
        } catch {
          /* keep going without capture */
        }
        setDragging(true)
      }
    }
    if (axis.current !== 'x') return

    // Right is only available while there is something to do with it, and a
    // pull further than the commit point resists, so the row cannot be dragged
    // off into space.
    let next = open ? mx - trayW : mx
    if (!onSwipeRight && next > 0) next = 0
    if (next > COMMIT) next = COMMIT + (next - COMMIT) * 0.25
    if (next < -trayW) next = -trayW + (next + trayW) * 0.25
    put(next)
  }

  const up = () => {
    const wasDragging = axis.current === 'x'
    start.current = null
    axis.current = 'none'
    if (!wasDragging) return
    setDragging(false)
    const travelled = dxRef.current
    if (onSwipeRight && travelled >= COMMIT) {
      put(0)
      setOpen(false)
      onSwipeRight()
      return
    }
    if (travelled <= -COMMIT / 2) {
      setOpen(true)
      put(-trayW)
      return
    }
    setOpen(false)
    put(0)
  }

  const armed = dx >= COMMIT

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Behind, on the left: what a right-swipe is about to do. It fills in
          as you pull, so the outcome is visible before you let go. */}
      {onSwipeRight && dx > 0 && (
        <div
          className={cn(
            'absolute inset-y-0 left-0 flex items-center gap-2 px-4 text-[12.5px] font-semibold transition-colors duration-150',
            armed ? 'bg-success text-accent-contrast' : 'bg-success/25 text-success',
          )}
          style={{ width: Math.max(dx, 0) }}
          aria-hidden
        >
          <RightIcon size={16} strokeWidth={3} className="shrink-0" />
          {dx > 70 && <span className="truncate">{rightLabel}</span>}
        </div>
      )}

      {/* Behind, on the right: the same actions the "…" menu holds. */}
      {dx < 0 && (
        <div className="absolute inset-y-0 right-0 flex" style={{ width: trayW }}>
          {actions.slice(0, 3).map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => {
                setOpen(false)
                put(0)
                a.onSelect()
              }}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10.5px] font-medium',
                a.danger ? 'bg-danger text-accent-contrast' : 'bg-surface-2 text-fg',
              )}
            >
              <a.icon size={16} aria-hidden />
              <span className="px-1 text-center leading-tight">{a.label}</span>
            </button>
          ))}
        </div>
      )}

      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        style={{ transform: `translate3d(${dx}px,0,0)` }}
        className={cn(
          'relative bg-surface',
          // Off while the finger is down: the row must be exactly where the
          // finger is, not easing towards it.
          !dragging && 'transition-transform duration-200 ease-out',
        )}
      >
        {children}
      </div>
    </div>
  )
}
