import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MAX_TOP, MAX_WIDGETS, WIDGETS, WIDGETS_BY_ID, fitsZone, type WidgetContext } from './registry'

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
  topLayout,
  onTopChange,
  ctx,
}: {
  layout: string[]
  onChange: (next: string[]) => void
  topLayout: string[]
  onTopChange: (next: string[]) => void
  ctx: WidgetContext
}) {
  const full = layout.length >= MAX_WIDGETS
  const available = WIDGETS.filter(
    (w) => !layout.includes(w.id) && (w.availableWhen?.(ctx) ?? true),
  )

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
          No widgets. Your due list is still here — add anything below to fill the rail.
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
                <button
                  type="button"
                  onClick={() => onChange(layout.filter((x) => x !== id))}
                  aria-label={`Remove ${w.name}`}
                  className="grid size-6 place-items-center rounded text-subtle transition-colors duration-150 hover:bg-danger/15 hover:text-danger"
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {available.length > 0 && (
        <>
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            Available
          </p>
          <ul className="flex flex-col gap-1.5">
            {available.map((w) => {
              const Icon = w.icon
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    disabled={full}
                    onClick={() => onChange([...layout, w.id])}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg border border-border bg-surface px-2.5 py-2 text-left transition-colors duration-150',
                      full
                        ? 'cursor-not-allowed opacity-50'
                        : 'hover:border-border-strong hover:bg-surface-2',
                    )}
                  >
                    <Icon size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-medium text-fg">{w.name}</span>
                      <span className="block text-[11.5px] leading-snug text-subtle">
                        {w.description}
                      </span>
                    </span>
                    {!full && <Plus size={13} className="mt-0.5 shrink-0 text-subtle" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {full && (
        <p className="mt-2 text-[11.5px] text-subtle">
          {MAX_WIDGETS} widgets is the cap — remove one to add another. Today stays
          glanceable on purpose.
        </p>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
          Above the due list
        </p>
        <p className="mb-2.5 text-[11.5px] leading-snug text-subtle">
          One wide card, or two side by side. Only widgets with a wide layout can
          go here.
        </p>
        <TopZone layout={topLayout} onChange={onTopChange} ctx={ctx} />
      </div>
    </div>
  )
}

/** The wide band above the due list. Separate from the rail list because the
 * constraint is different: at most two, and only widgets that declare a wide or
 * half layout are eligible. */
function TopZone({
  layout,
  onChange,
  ctx,
}: {
  layout: string[]
  onChange: (next: string[]) => void
  ctx: WidgetContext
}) {
  const full = layout.length >= MAX_TOP
  const eligible = WIDGETS.filter(
    (w) =>
      !layout.includes(w.id) &&
      (fitsZone(w, 'wide') || fitsZone(w, 'half')) &&
      (w.availableWhen?.(ctx) ?? true),
  )

  return (
    <>
      {layout.length > 0 && (
        <ul className="mb-2.5 flex flex-col gap-1.5">
          {layout.map((id) => {
            const w = WIDGETS_BY_ID.get(id)
            if (!w) return null
            const Icon = w.icon
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
              >
                <Icon size={13} className="shrink-0 text-subtle" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-fg">{w.name}</span>
                <span className="shrink-0 text-[11px] text-subtle">
                  {layout.length > 1 ? 'half' : 'wide'}
                </span>
                <button
                  type="button"
                  onClick={() => onChange(layout.filter((x) => x !== id))}
                  aria-label={`Remove ${w.name} from the top band`}
                  className="grid size-6 place-items-center rounded text-subtle transition-colors duration-150 hover:bg-danger/15 hover:text-danger"
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {eligible.length > 0 && !full && (
        <ul className="flex flex-wrap gap-1.5">
          {eligible.map((w) => {
            const Icon = w.icon
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onChange([...layout, w.id])}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[12px] text-fg transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
                >
                  <Icon size={12} className="text-accent" aria-hidden />
                  {w.name}
                  <Plus size={11} className="text-subtle" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {full && (
        <p className="text-[11.5px] text-subtle">
          Two is the most that stays readable side by side.
        </p>
      )}
    </>
  )
}
