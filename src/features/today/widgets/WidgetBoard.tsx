import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { WIDGETS_BY_ID, fitsZone, type WidgetZone } from './registry'

/**
 * One drag surface across every widget zone on Today.
 *
 * Three things the previous version got wrong, all fixed here:
 *
 *  1. THE DROP RECESS MOVED WITH THE WIDGET. It was rendered inside the element
 *     being transformed, so it travelled along and you never saw where the thing
 *     would land. The slot and the moving part are now separate elements — the
 *     slot never transforms.
 *  2. NO CROSS-ZONE DRAGGING. Each zone had its own isolated drag state and
 *     could only reorder within itself. A single controller now owns all zones
 *     and hit-tests across all of them.
 *  3. THE DRAG WAS AXIS-LOCKED. The widget follows the pointer freely in both
 *     axes; what's constrained is where it may LAND, not where it may move.
 *     A zone that can't take the widget simply doesn't accept the drop.
 *
 * The dragged widget is drawn as a fixed-position copy following the pointer,
 * which is what makes moving between containers possible at all — the real
 * element can't leave its parent.
 */

export interface ZoneSpec {
  id: string
  ids: string[]
  /**
   * Set this zone's contents. MUST also remove those ids from every other zone
   * in the same update — the board relies on that for cross-zone moves.
   */
  setIds: (next: string[]) => void
  /** Which widget layout this zone renders. */
  layout: WidgetZone
  max: number
}

interface DragState {
  id: string
  fromZone: string
  /** Pointer offset inside the widget, so it doesn't jump to the cursor. */
  dx: number
  dy: number
  width: number
  x: number
  y: number
}

interface BoardCtx {
  editing: boolean
  drag: DragState | null
  hoverZone: string | null
  registerZone: (id: string, el: HTMLElement | null) => void
  registerItem: (zone: string, id: string, el: HTMLElement | null) => void
  begin: (zone: string, id: string, e: React.PointerEvent) => void
  remove: (zone: string, id: string) => void
}

const Ctx = createContext<BoardCtx | null>(null)

export function WidgetBoard({
  zones,
  editing,
  children,
}: {
  zones: ZoneSpec[]
  editing: boolean
  children: React.ReactNode
}) {
  const reduced = usePrefersReducedMotion()
  const zoneEls = useRef(new Map<string, HTMLElement>())
  const itemEls = useRef(new Map<string, HTMLElement>()) // key: `${zone}:${id}`
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoverZone, setHoverZone] = useState<string | null>(null)
  const prevRects = useRef(new Map<string, DOMRect>())

  // Latest zones, so the pointer handlers never close over a stale array. Synced
  // in an effect rather than assigned during render (react-hooks/refs); the
  // effect runs after each reorder, before the next pointermove can fire.
  const zonesRef = useRef(zones)
  useEffect(() => {
    zonesRef.current = zones
  }, [zones])

  /** FLIP: after any reorder, play every item from where it was to where it is. */
  useLayoutEffect(() => {
    if (reduced || prevRects.current.size === 0) {
      prevRects.current.clear()
      return
    }
    for (const [key, prev] of prevRects.current) {
      const el = itemEls.current.get(key)
      if (!el) continue
      const now = el.getBoundingClientRect()
      const dx = prev.left - now.left
      const dy = prev.top - now.top
      if (!dx && !dy) continue
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }],
        { duration: 200, easing: 'cubic-bezier(0.2,0,0,1)' },
      )
    }
    prevRects.current.clear()
  }, [zones, reduced])

  const capture = useCallback(() => {
    prevRects.current.clear()
    for (const [key, el] of itemEls.current) {
      prevRects.current.set(key, el.getBoundingClientRect())
    }
  }, [])

  const registerZone = useCallback((id: string, el: HTMLElement | null) => {
    if (el) zoneEls.current.set(id, el)
    else zoneEls.current.delete(id)
  }, [])

  const registerItem = useCallback((zone: string, id: string, el: HTMLElement | null) => {
    const key = `${zone}:${id}`
    if (el) itemEls.current.set(key, el)
    else itemEls.current.delete(key)
  }, [])

  const remove = useCallback((zone: string, id: string) => {
    const z = zonesRef.current.find((x) => x.id === zone)
    z?.setIds(z.ids.filter((x) => x !== id))
  }, [])

  const begin = useCallback(
    (zone: string, id: string, e: React.PointerEvent) => {
      const el = itemEls.current.get(`${zone}:${id}`)
      if (!el) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      setDrag({
        id,
        fromZone: zone,
        dx: e.clientX - r.left,
        dy: e.clientY - r.top,
        width: r.width,
        x: e.clientX,
        y: e.clientY,
      })

      const onMove = (ev: PointerEvent) => {
        setDrag((d) => (d ? { ...d, x: ev.clientX, y: ev.clientY } : d))

        // Which zone is the pointer inside? Zones are checked before items so a
        // drop into an EMPTY zone still works.
        let target: ZoneSpec | null = null
        for (const z of zonesRef.current) {
          const zel = zoneEls.current.get(z.id)
          if (!zel) continue
          const zr = zel.getBoundingClientRect()
          if (
            ev.clientX >= zr.left &&
            ev.clientX <= zr.right &&
            ev.clientY >= zr.top &&
            ev.clientY <= zr.bottom
          ) {
            target = z
            break
          }
        }

        const w = WIDGETS_BY_ID.get(id)
        // A zone only accepts a widget that has a layout for it, and only while
        // it has room — the widget can still be dragged over it, just not
        // dropped, which is the distinction between moving and landing.
        const accepts =
          !!target &&
          !!w &&
          fitsZone(w, target.layout) &&
          (target.ids.includes(id) || target.ids.length < target.max)

        setHoverZone(accepts && target ? target.id : null)
        if (!accepts || !target) return

        const from = zonesRef.current.find((z) => z.ids.includes(id))
        if (!from) return

        // Index within the target: the first item whose midpoint the pointer has
        // passed, else the end.
        const idx = target.ids
          .filter((x) => x !== id)
          .findIndex((otherId) => {
            const oel = itemEls.current.get(`${target.id}:${otherId}`)
            if (!oel) return false
            const orr = oel.getBoundingClientRect()
            return ev.clientY < orr.top + orr.height / 2
          })

        const without = target.ids.filter((x) => x !== id)
        const at = idx === -1 ? without.length : idx
        const nextTarget = [...without.slice(0, at), id, ...without.slice(at)]

        if (from.id === target.id && nextTarget.join() === target.ids.join()) return
        capture()
        // Only the TARGET is written. `setIds` is contracted to make zones
        // exclusive — the owner strips the id from wherever else it was in the
        // same update — so writing the source too would be a second, racing
        // patch built from the same stale closure.
        target.setIds(nextTarget)
      }

      const onUp = () => {
        setDrag(null)
        setHoverZone(null)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    },
    [capture],
  )

  const value = useMemo(
    () => ({ editing, drag, hoverZone, registerZone, registerItem, begin, remove }),
    [editing, drag, hoverZone, registerZone, registerItem, begin, remove],
  )

  const dragged = drag ? WIDGETS_BY_ID.get(drag.id) : null

  return (
    <Ctx value={value}>
      {children}
      {/* The travelling copy. Fixed-position and portalled so it can move
          between zones — the real element can never leave its parent. */}
      {drag &&
        dragged &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-[60] opacity-95"
            style={{
              left: drag.x - drag.dx,
              top: drag.y - drag.dy,
              width: drag.width,
              transform: 'scale(1.03)',
              filter: 'drop-shadow(0 18px 40px rgba(0,0,0,.55))',
            }}
          >
            {dragged.render('rail')}
          </div>,
          document.body,
        )}
    </Ctx>
  )
}

function useBoard(): BoardCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useBoard must be used within <WidgetBoard>')
  return ctx
}

/** One drop area. Renders its widgets and shows where a drop would land. */
export function WidgetZoneView({
  zone,
  className,
  renderItem,
  emptyHint,
}: {
  zone: ZoneSpec
  className?: string
  renderItem: (id: string) => React.ReactNode
  /** Shown while dragging if the zone is empty, so it's a visible target. */
  emptyHint?: string
}) {
  const { editing, drag, hoverZone, registerZone, registerItem, begin, remove } = useBoard()
  const w = drag ? WIDGETS_BY_ID.get(drag.id) : null
  const couldAccept =
    !!drag && !!w && fitsZone(w, zone.layout) && (zone.ids.includes(drag.id) || zone.ids.length < zone.max)

  return (
    <div
      ref={(el) => registerZone(zone.id, el)}
      className={cn(
        className,
        // A zone that can take the widget in hand reads as a target; one that
        // can't stays quiet rather than teasing a drop it will refuse.
        drag && couldAccept && 'rounded-xl outline-1 outline-offset-4 outline-dashed outline-accent/40',
        drag && hoverZone === zone.id && 'outline-accent/80',
      )}
    >
      {zone.ids.map((id) => {
        const held = drag?.id === id
        return (
          <div
            key={id}
            ref={(el) => registerItem(zone.id, id, el)}
            onPointerDown={(e) => editing && begin(zone.id, id, e)}
            className={cn(
              'relative',
              editing && 'cursor-grab touch-none select-none active:cursor-grabbing',
              editing && !held && 'ct-wiggle',
            )}
          >
            {/* The landing slot. Outside the moving copy, so it stays put and
                shows exactly where the widget will end up. */}
            {held && (
              <div
                aria-hidden
                className="absolute inset-0 rounded-xl bg-canvas/80 ring-1 ring-border-strong ring-inset"
              />
            )}

            {editing && <div className="absolute inset-0 z-10 rounded-xl" aria-hidden />}

            {editing && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => remove(zone.id, id)}
                aria-label="Remove widget"
                className="absolute -top-2 -left-2 z-20 grid size-6 place-items-center rounded-full border border-border bg-surface-2 text-subtle shadow-lg transition-colors duration-150 hover:text-danger"
              >
                <X size={13} aria-hidden />
              </button>
            )}

            <div className={cn(held && 'invisible')}>{renderItem(id)}</div>
          </div>
        )
      })}

      {zone.ids.length === 0 && drag && couldAccept && emptyHint && (
        <p className="rounded-xl border border-dashed border-accent/40 px-3 py-6 text-center text-[12px] text-subtle">
          {emptyHint}
        </p>
      )}
    </div>
  )
}
