import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CampusEvent } from '@/data/community'
import { cn } from '@/lib/cn'

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const EXIT_MS = 280

type Entry = { id: string; exiting: boolean }

/** A FLIP-animated list: when the filter changes, non-matching items fade out in
 * place and the survivors glide to their new positions (Web Animations API), so
 * the layout never hard-snaps. Reduced-motion safe — all animation is gated and
 * the CSS fades are zeroed by the global reduced-motion block. The displayed set
 * is always in the global (date-sorted) order, so items never jump. */
export function AnimatedEventList({
  events,
  visibleIds,
  reduced,
  className,
  empty,
  renderItem,
}: {
  /** ALL events in global (sorted) order. */
  events: CampusEvent[]
  /** Ids that currently match the filter. */
  visibleIds: Set<string>
  reduced: boolean
  className?: string
  /** Shown once the matching set is empty (after any exit animation finishes). */
  empty?: React.ReactNode
  renderItem: (event: CampusEvent) => React.ReactNode
}) {
  const [entries, setEntries] = useState<Entry[]>(() =>
    events.filter((e) => visibleIds.has(e.id)).map((e) => ({ id: e.id, exiting: false })),
  )
  // Tracked as state (not a ref) so the adjust-state-during-render reconcile below
  // doesn't read a ref during render (react-hooks/refs).
  const [prevVisible, setPrevVisible] = useState(visibleIds)
  const elRefs = useRef<Map<string, HTMLElement>>(new Map())
  const prevRects = useRef<Map<string, DOMRect>>(new Map())

  // Reconcile when the filter changes (adjust-state-during-render, React's
  // recommended pattern — no effect, so exiting items render faded, not removed).
  if (prevVisible !== visibleIds) {
    setPrevVisible(visibleIds)
    setEntries((prev) => {
      const status = new Map<string, boolean>() // id → exiting?
      prev.forEach((e) => status.set(e.id, !visibleIds.has(e.id)))
      events.forEach((e) => {
        if (visibleIds.has(e.id)) status.set(e.id, false)
      })
      return events.filter((e) => status.has(e.id)).map((e) => ({ id: e.id, exiting: status.get(e.id)! }))
    })
  }

  // Remove faded-out items after their exit transition.
  useEffect(() => {
    if (!entries.some((e) => e.exiting)) return
    const t = window.setTimeout(
      () => setEntries((prev) => prev.filter((e) => !e.exiting)),
      reduced ? 0 : EXIT_MS,
    )
    return () => window.clearTimeout(t)
  }, [entries, reduced])

  // FLIP: glide survivors, fade in newcomers.
  useLayoutEffect(() => {
    const rects = new Map<string, DOMRect>()
    elRefs.current.forEach((el, id) => rects.set(id, el.getBoundingClientRect()))
    if (!reduced) {
      elRefs.current.forEach((el, id) => {
        const prev = prevRects.current.get(id)
        const now = rects.get(id)!
        el.getAnimations().forEach((a) => a.cancel())
        if (prev) {
          const dx = prev.left - now.left
          const dy = prev.top - now.top
          if (dx || dy) {
            el.animate(
              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0,0)' }],
              { duration: 320, easing: EASE },
            )
          }
        } else {
          el.animate(
            [
              { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
              { opacity: 1, transform: 'none' },
            ],
            { duration: 280, easing: EASE },
          )
        }
      })
    }
    prevRects.current = rects
  }, [entries, reduced])

  const byId = new Map(events.map((e) => [e.id, e]))

  if (entries.length === 0) return <>{empty}</>

  return (
    <div className={className}>
      {entries.map((entry) => {
        const event = byId.get(entry.id)
        if (!event) return null
        return (
          <div
            key={entry.id}
            ref={(el) => {
              if (el) elRefs.current.set(entry.id, el)
              else elRefs.current.delete(entry.id)
            }}
            inert={entry.exiting ? true : undefined}
            style={{ transitionTimingFunction: EASE }}
            className={cn(
              'transition-[opacity,transform] duration-[280ms] will-change-[opacity,transform]',
              entry.exiting && 'pointer-events-none scale-[0.96] opacity-0',
            )}
          >
            {renderItem(event)}
          </div>
        )
      })}
    </div>
  )
}
