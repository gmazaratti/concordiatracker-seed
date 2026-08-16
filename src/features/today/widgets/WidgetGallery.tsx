import { useState } from 'react'
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  MAX_BELOW,
  MAX_TOP,
  MAX_WIDGETS,
  WIDGETS,
  WIDGETS_BY_ID,
  fitsZone,
  type WidgetContext,
  type WidgetDef,
} from './registry'

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
  belowLayout,
  onBelowChange,
  ctx,
}: {
  layout: string[]
  onChange: (next: string[]) => void
  topLayout: string[]
  onTopChange: (next: string[]) => void
  belowLayout: string[]
  onBelowChange: (next: string[]) => void
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
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {available.map((w) => (
              <li key={w.id}>
                <WidgetPreviewCard
                  def={w}
                  disabled={full}
                  onAdd={() => onChange([...layout, w.id])}
                />
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
          Above the due list
        </p>
        <p className="mb-2.5 text-[11.5px] leading-snug text-subtle">
          One wide card, or two side by side. Only widgets with a wide layout can
          go here.
        </p>
        <BandZone layout={topLayout} onChange={onTopChange} ctx={ctx} max={MAX_TOP} />
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
          Below the due list
        </p>
        <p className="mb-2.5 text-[11.5px] leading-snug text-subtle">
          Fills the space under your deadlines: useful on a light term, when the
          side column is otherwise much taller than the list.
        </p>
        <BandZone layout={belowLayout} onChange={onBelowChange} ctx={ctx} max={MAX_BELOW} />
      </div>
    </div>
  )
}

/** A horizontal band — above or below the due list. Separate from the rail list
 * because the constraint differs: a capped count, and only widgets that declare
 * a wide or half layout are eligible. */
function BandZone({
  layout,
  onChange,
  ctx,
  max,
}: {
  layout: string[]
  onChange: (next: string[]) => void
  ctx: WidgetContext
  max: number
}) {
  const full = layout.length >= max
  // Deliberately does NOT exclude widgets already in the rail: putting one up
  // here MOVES it rather than being blocked, which is what "I want weather at
  // the top" should do. TodayPage strips it from the rail on the way through.
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
                  aria-label={`Remove ${w.name} from this band`}
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
          {max} is the most that stays readable here.
        </p>
      )}
    </>
  )
}

/**
 * A widget in the library, shown as itself.
 *
 * The preview renders the REAL component with its real data, not a mockup — so
 * "Next class" shows your actual next class and the shuttle shows today's real
 * departures. A description told you what a widget was; this shows you, which is
 * the difference between a list and a library.
 *
 * `inert` + pointer-events-none means the preview can't be interacted with:
 * every click belongs to Add, and nothing inside can steal focus or navigate.
 */
function WidgetPreviewCard({
  def,
  disabled,
  onAdd,
}: {
  def: WidgetDef
  disabled: boolean
  onAdd: () => void
}) {
  const Icon = def.icon
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-canvas transition-colors duration-150',
        disabled ? 'opacity-50' : 'hover:border-border-strong',
      )}
    >
      <div className="pointer-events-none max-h-[132px] overflow-hidden p-2.5" inert>
        {def.render('rail')}
      </div>

      <div className="flex items-start gap-2 border-t border-border bg-surface px-2.5 py-2">
        <Icon size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium text-fg">{def.name}</span>
          <span className="block text-[11.5px] leading-snug text-subtle">{def.description}</span>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          aria-label={`Add ${def.name}`}
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent transition-colors duration-150 hover:bg-accent hover:text-accent-contrast disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
