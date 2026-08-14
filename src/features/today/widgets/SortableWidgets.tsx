import { useLayoutEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'

/**
 * Direct-manipulation widget reordering — the iPhone home-screen model.
 *
 * In edit mode you grab a widget and drag it; the others slide out of the way as
 * you cross them, and it settles where you drop it. Works on the page itself,
 * not in a list inside a dialog.
 *
 * WHY POINTER EVENTS, NOT HTML5 DRAG: native drag gives no control over the
 * dragged element's position, can't animate anything, and is close to unusable
 * on touch. Pointer events cover mouse, touch and stylus with one code path.
 *
 * WHY AN EDIT MODE: widgets contain real links — Next class opens a course,
 * Shortcuts are all links. Making them draggable at rest would mean every tap
 * races a drag. Apple has the same constraint and solves it the same way.
 *
 * The animation is FLIP (measure, reorder, invert, play) via the Web Animations
 * API — the same technique already used by the Community feed, so no library
 * joins the project.
 */
export function SortableWidgets({
  ids,
  onReorder,
  onRemove,
  editing,
  renderItem,
  axis = 'y',
  className,
}: {
  ids: string[]
  onReorder: (next: string[]) => void
  onRemove?: (id: string) => void
  editing: boolean
  renderItem: (id: string) => React.ReactNode
  /** 'y' for the rail, 'xy' for the top band which can sit side by side. */
  axis?: 'y' | 'xy'
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const nodes = useRef(new Map<string, HTMLElement>())
  const [dragId, setDragId] = useState<string | null>(null)
  // Rects captured just before a reorder, so the FLIP pass knows where things were.
  const prevRects = useRef(new Map<string, DOMRect>())

  /** Play every non-dragged item from where it was to where it now is. */
  useLayoutEffect(() => {
    if (reduced || prevRects.current.size === 0) {
      prevRects.current.clear()
      return
    }
    for (const [id, prev] of prevRects.current) {
      const el = nodes.current.get(id)
      if (!el || id === dragId) continue
      const next = el.getBoundingClientRect()
      const dx = prev.left - next.left
      const dy = prev.top - next.top
      if (!dx && !dy) continue
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
      )
    }
    prevRects.current.clear()
  }, [ids, dragId, reduced])

  function captureRects() {
    prevRects.current.clear()
    for (const [id, el] of nodes.current) {
      prevRects.current.set(id, el.getBoundingClientRect())
    }
  }

  function startDrag(e: React.PointerEvent, id: string) {
    if (!editing) return
    const el = nodes.current.get(id)
    if (!el) return
    e.preventDefault()
    ;(e.target as Element).setPointerCapture?.(e.pointerId)

    const startRect = el.getBoundingClientRect()
    const grabX = e.clientX
    const grabY = e.clientY
    setDragId(id)

    // The dragged element is moved imperatively rather than through state: a
    // re-render per pointermove would be visibly janky.
    el.style.zIndex = '30'
    el.style.willChange = 'transform'

    const onMove = (ev: PointerEvent) => {
      const dx = axis === 'xy' ? ev.clientX - grabX : 0
      const dy = ev.clientY - grabY
      el.style.transform = `translate(${dx}px, ${dy}px) scale(1.03)`

      // Which slot is the pointer over? Compare against the CURRENT positions of
      // the other items, ignoring the one in hand.
      const overId = [...nodes.current.entries()].find(([otherId, otherEl]) => {
        if (otherId === id) return false
        const r = otherEl.getBoundingClientRect()
        return (
          ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom
        )
      })?.[0]

      if (overId) {
        const from = ids.indexOf(id)
        const to = ids.indexOf(overId)
        if (from !== -1 && to !== -1 && from !== to) {
          captureRects()
          const next = [...ids]
          next.splice(from, 1)
          next.splice(to, 0, id)
          onReorder(next)
        }
      }
      void startRect
    }

    const onUp = () => {
      el.style.transition = reduced ? '' : 'transform 180ms cubic-bezier(0.2, 0, 0, 1)'
      el.style.transform = ''
      window.setTimeout(
        () => {
          el.style.transition = ''
          el.style.zIndex = ''
          el.style.willChange = ''
        },
        reduced ? 0 : 180,
      )
      setDragId(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <div className={className}>
      {ids.map((id) => (
        <div
          key={id}
          ref={(el) => {
            if (el) nodes.current.set(id, el)
            else nodes.current.delete(id)
          }}
          onPointerDown={(e) => startDrag(e, id)}
          className={cn(
            'relative',
            editing && 'cursor-grab touch-none select-none active:cursor-grabbing',
            editing && !reduced && dragId !== id && 'ct-wiggle',
            dragId === id && 'opacity-95',
          )}
        >
          {/* Blocks clicks reaching links inside a widget while editing, so a
              drag can never navigate you away mid-gesture. */}
          {editing && <div className="absolute inset-0 z-10 rounded-xl" aria-hidden />}

          {editing && onRemove && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onRemove(id)}
              aria-label="Remove widget"
              className="absolute -top-2 -left-2 z-20 grid size-6 place-items-center rounded-full border border-border bg-surface-2 text-subtle shadow-lg transition-colors duration-150 hover:text-danger"
            >
              <X size={13} aria-hidden />
            </button>
          )}
          {renderItem(id)}
        </div>
      ))}
    </div>
  )
}
