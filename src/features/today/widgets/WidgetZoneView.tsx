import { GripHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { WIDGETS_BY_ID } from './registry'
import { HEADER_BAND, useBoard, zoneAccepts, type ZoneSpec } from './board-context'

/** One drop area. Renders its widgets and shows where a drop would land. */
export function WidgetZoneView({
  zone,
  className,
  renderItem,
  emptyHint,
  itemClass,
  renderControls,
}: {
  zone: ZoneSpec
  className?: string
  renderItem: (id: string) => React.ReactNode
  /** Extra classes per card (the grid span of its size). */
  itemClass?: (id: string) => string | undefined
  /** Edit-mode controls drawn over the card (the size picker). */
  renderControls?: (id: string) => React.ReactNode
  /** Shown while dragging if the zone is empty, so it's a visible target. */
  emptyHint?: string
}) {
  const { editing, requestEdit, drag, hoverZone, registerZone, registerItem, begin, remove } = useBoard()
  const w = drag ? WIDGETS_BY_ID.get(drag.id) : null
  const couldAccept =
    !!drag && !!w && zoneAccepts(w, zone.layout) && (zone.ids.includes(drag.id) || zone.ids.length < zone.max)

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
        const def = WIDGETS_BY_ID.get(id)
        return (
          <div
            key={id}
            ref={(el) => registerItem(zone.id, id, el)}
            onPointerDown={(e) => editing && begin(zone.id, id, e)}
            /* Only the header band arms edit mode. Widgets are full of links
               and buttons, and a double-click anywhere would turn a missed
               tap into a rearranged screen. */
            onDoubleClick={(e) => {
              // The same gesture undoes itself: in edit mode nothing inside a
              // card is live (every press is a drag), so a double-click
              // anywhere on one is unambiguous and leaves edit mode.
              if (editing) {
                requestEdit()
                return
              }
              const r = e.currentTarget.getBoundingClientRect()
              if (e.clientY - r.top <= HEADER_BAND) requestEdit()
            }}
            className={cn(
              // h-full so two widgets sharing a row end level. Without it each
              // card was its own height and the shorter one left a gap under
              // it, which reads as a broken layout rather than as two things
              // that happen to have different amounts to say.
              'relative h-full',
              itemClass?.(id),
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

            {/* The grab bar. Edit mode says "these move"; this says "and here
                is where you take hold of them", which is the half that was
                missing — a wiggling card with no handle reads as a glitch. */}
            {editing && !held && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-[11] flex h-9 items-center justify-center rounded-t-xl bg-accent/15 ring-1 ring-accent/35 ring-inset"
              >
                <GripHorizontal size={14} className="text-accent" />
              </div>
            )}

            {editing && !def?.fixed && (
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

            {editing && !held && renderControls && (
              <div className="absolute top-1.5 right-1.5 z-20" onPointerDown={(e) => e.stopPropagation()}>
                {renderControls(id)}
              </div>
            )}

            <div className={cn('h-full', held && 'invisible')}>{renderItem(id)}</div>
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
