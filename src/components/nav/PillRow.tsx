import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'

export interface PillItem {
  key: string
  to: string
  label: string
  /** The glyph; `active` lets it switch to its filled / heavier form. */
  render: (active: boolean) => React.ReactNode
  dot?: boolean
}

/** Side padding inside the pill; must match the `px-1.5` below. */
const PAD = 6
/** Movement before a press turns into a scrub, so a tap stays a tap. */
const SCRUB_SLOP = 8

/**
 * One row of the floating tab pill: the icons, the capsule behind the active
 * one, and Instagram's scrub gesture.
 *
 * THE CAPSULE IS ONE ELEMENT that slides between slots on a spring (a single
 * transform, so it is a compositor animation), rather than a background on
 * each icon that switches instantly.
 *
 * SCRUBBING: press on the pill and slide. Past a few pixels the capsule
 * follows your finger slot by slot, with a light tick as it crosses each one,
 * and letting go lands on the tab under your finger. A plain tap is untouched:
 * it is the link's own click. The page does not change DURING a scrub — only
 * on release — which is also what Instagram does.
 */
export function PillRow({
  items,
  active,
  onCommit,
}: {
  items: PillItem[]
  /** Index of the current tab, or -1 when none is (a profile page). */
  active: number
  onCommit: (item: PillItem) => void
}) {
  const track = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: number; x0: number; moved: boolean } | null>(null)
  const scrubAt = useRef<number | null>(null)
  const swallowClick = useRef(false)
  const [scrub, setScrub] = useState<number | null>(null)

  const n = items.length
  const shown = scrub ?? active

  const indexAt = (clientX: number) => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return active
    const slot = (r.width - PAD * 2) / n
    return Math.min(n - 1, Math.max(0, Math.floor((clientX - r.left - PAD) / slot)))
  }

  const end = () => {
    drag.current = null
    scrubAt.current = null
    setScrub(null)
  }

  return (
    <div
      ref={track}
      className="relative flex h-full items-center px-1.5 touch-none select-none"
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return
        drag.current = { id: e.pointerId, x0: e.clientX, moved: false }
      }}
      onPointerMove={(e) => {
        const d = drag.current
        if (!d || d.id !== e.pointerId) return
        if (!d.moved) {
          if (Math.abs(e.clientX - d.x0) < SCRUB_SLOP) return
          d.moved = true
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            /* an unknown pointer: the scrub still works without capture */
          }
        }
        const i = indexAt(e.clientX)
        if (i !== scrubAt.current) {
          scrubAt.current = i
          setScrub(i)
          haptic('select')
        }
      }}
      onPointerUp={(e) => {
        const d = drag.current
        if (d?.moved && d.id === e.pointerId) {
          swallowClick.current = true
          const i = indexAt(e.clientX)
          end()
          if (i !== active) {
            haptic('tap')
            onCommit(items[i])
          }
          return
        }
        drag.current = null
      }}
      onPointerCancel={end}
      onClickCapture={(e) => {
        // The click that ends a scrub is not a tap on whatever it ended over.
        if (swallowClick.current) {
          swallowClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
    >
      {/* The capsule: one element, slid by index. */}
      <span
        aria-hidden
        className={cn('ct-pill-capsule pointer-events-none absolute top-1.5 bottom-1.5', scrub !== null && 'ct-pill-capsule-held')}
        style={{
          left: PAD,
          width: `calc((100% - ${PAD * 2}px) / ${n})`,
          transform: `translate3d(${Math.max(0, shown) * 100}%, 0, 0)`,
          opacity: shown < 0 ? 0 : 1,
        }}
      />
      {items.map((it, i) => {
        const on = i === shown
        return (
          <Link
            key={it.key}
            to={it.to}
            aria-label={it.label}
            aria-current={i === active ? 'page' : undefined}
            draggable={false}
            onClick={() => {
              if (i !== active) haptic('tap')
            }}
            className="relative z-[1] grid h-12 min-w-0 flex-1 place-items-center"
          >
            <span
              className={cn(
                'ct-pill-icon relative grid place-items-center',
                on ? 'ct-pill-icon-on text-[var(--ct-glass-ink)]' : 'text-[var(--ct-glass-ink-dim)]',
              )}
            >
              {it.render(on)}
              {it.dot && (
                <span
                  className="absolute -right-1 -bottom-0.5 size-[9px] rounded-full bg-[#ff3b30] ring-[1.5px] ring-[var(--ct-glass-ring)]"
                  aria-hidden
                />
              )}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
