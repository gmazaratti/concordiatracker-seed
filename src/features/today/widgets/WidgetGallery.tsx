import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MAX_WIDGETS, WIDGETS, WIDGETS_BY_ID, type WidgetContext } from './registry'

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
  ctx,
}: {
  layout: string[]
  onChange: (next: string[]) => void
  ctx: WidgetContext
}) {
  const full = layout.length >= MAX_WIDGETS
  const available = WIDGETS.filter(
    (w) => !layout.includes(w.id) && (w.availableWhen?.(ctx) ?? true),
  )

  const move = (from: number, delta: number) => {
    const to = from + delta
    if (to < 0 || to >= layout.length) return
    const next = [...layout]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

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
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
              >
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
    </div>
  )
}
