import { Plus, X } from 'lucide-react'
import { ADDABLE, WIDGETS_BY_ID, sizesFor, type WidgetContext } from './registry'

/** The wide column. Separate from the rail list because the constraint differs:
 * a capped count, and only widgets that declare a wide layout are eligible.
 * `fixed` entries (the due list) show without a remove button — they can be
 * moved, never deleted. */
export function BandZone({
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
  const eligible = ADDABLE.filter(
    (w) => !layout.includes(w.id) && sizesFor(w).length > 0 && (w.availableWhen?.(ctx) ?? true),
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
                {w.fixed ? (
                  <span className="shrink-0 pr-1 text-[11px] text-subtle">always on</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChange(layout.filter((x) => x !== id))}
                    aria-label={`Remove ${w.name} from the wide column`}
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
