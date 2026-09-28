import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ADDABLE, MAX_MAIN, MAX_WIDGETS, WIDGETS_BY_ID, type WidgetContext } from './registry'
import { BandZone } from './BandZone'
import { WidgetPreviewCard } from './WidgetPreviewCard'

/**
 * Add, remove, and reorder the widgets on Today.
 *
 * This doubles as the feature directory. New campus tools ship as widgets, so
 * browsing this list is how a student discovers them — which is the whole reason
 * the app can keep growing without ever growing a fifth tab.
 */
export function WidgetGallery({
  layout,
  onChange,
  mainLayout,
  onMainChange,
  ctx,
}: {
  layout: string[]
  onChange: (next: string[]) => void
  mainLayout: string[]
  onMainChange: (next: string[]) => void
  ctx: WidgetContext
}) {
  const full = layout.length >= MAX_WIDGETS
  const notPlaced = ADDABLE.filter((w) => !layout.includes(w.id) && !mainLayout.includes(w.id))
  const available = notPlaced.filter((w) => w.availableWhen?.(ctx) ?? true)
  // Widgets that need something first (a course) used to be left out of the
  // list entirely, so a new account saw a shorter library and had no way to
  // know the rest existed. They are listed, locked, with what unlocks them.
  const locked = notPlaced.filter((w) => !(w.availableWhen?.(ctx) ?? true))

  // Native HTML5 drag — no library, which keeps the "no animation/drag deps"
  // rule intact. The arrow buttons stay: dragging is unusable by keyboard and on
  // many touch devices, so it's the enhancement, not the only way to reorder.
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= layout.length || from === to) return
    const next = [...layout]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const move = (from: number, delta: number) => reorder(from, from + delta)

  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        On your Today
      </p>
      {layout.length === 0 ? (
        <p className="mb-3 rounded-lg border border-dashed border-border px-3 py-2.5 text-[12.5px] text-subtle">
          No widgets. Your due list is still here: add anything below to fill the rail.
        </p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1.5">
          {layout.map((id, i) => {
            const w = WIDGETS_BY_ID.get(id)
            if (!w) return null
            const Icon = w.icon
            return (
              <li
                key={id}
                draggable
                onDragStart={(e) => {
                  setDragging(i)
                  e.dataTransfer.effectAllowed = 'move'
                  // Firefox refuses to start a drag without payload.
                  e.dataTransfer.setData('text/plain', id)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  if (dragging !== null && over !== i) setOver(i)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragging !== null) reorder(dragging, i)
                  setDragging(null)
                  setOver(null)
                }}
                onDragEnd={() => {
                  setDragging(null)
                  setOver(null)
                }}
                className={cn(
                  'flex cursor-grab items-center gap-2 rounded-lg border bg-surface px-2.5 py-1.5 transition-colors duration-150 active:cursor-grabbing',
                  dragging === i
                    ? 'border-accent/50 opacity-40'
                    : over === i && dragging !== null
                      ? 'border-accent bg-accent-soft'
                      : 'border-border',
                )}
              >
                <GripVertical size={13} className="shrink-0 text-subtle" aria-hidden />
                <Icon size={13} className="shrink-0 text-subtle" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">{w.name}</span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${w.name} up`}
                  className="grid size-6 place-items-center rounded text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronUp size={13} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === layout.length - 1}
                  aria-label={`Move ${w.name} down`}
                  className="grid size-6 place-items-center rounded text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:pointer-events-none disabled:opacity-30"
                >
                  <ChevronDown size={13} aria-hidden />
                </button>
                {w.fixed ? (
                  <span className="px-1 text-[11px] text-subtle">always on</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChange(layout.filter((x) => x !== id))}
                    aria-label={`Remove ${w.name}`}
                    className="grid size-6 place-items-center rounded text-subtle transition-colors duration-150 hover:bg-danger/15 hover:text-danger"
                  >
                    <X size={13} aria-hidden />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {available.length + locked.length > 0 && (
        <>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Available
          </p>
          <ul className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
            {available.map((w) => (
              <li key={w.id} className="h-full">
                <WidgetPreviewCard
                  def={w}
                  disabled={full}
                  onAdd={() => onChange([...layout, w.id])}
                />
              </li>
            ))}
            {locked.map((w) => (
              <li key={w.id} className="h-full">
                <WidgetPreviewCard def={w} disabled lockedReason="Add a course first" onAdd={() => {}} />
              </li>
            ))}
          </ul>
        </>
      )}

      {full && (
        <p className="mt-2 text-[11.5px] text-subtle">
          {MAX_WIDGETS} widgets is the cap: remove one to add another. Today stays
          glanceable on purpose.
        </p>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
          The wide column
        </p>
        <p className="mb-2.5 text-[11.5px] leading-snug text-subtle">
          Cards in rows, with your due list among them. Each card can be Small, Medium or
          Wide: double-click a card's header on Today to rearrange and resize, and
          double-click again to finish.
        </p>
        <BandZone layout={mainLayout} onChange={onMainChange} ctx={ctx} max={MAX_MAIN} />
      </div>
    </div>
  )
}
