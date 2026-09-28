import { Lock, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { WidgetDef } from './registry'

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
export function WidgetPreviewCard({
  def,
  disabled,
  lockedReason,
  onAdd,
}: {
  def: WidgetDef
  disabled: boolean
  /** Why it cannot be added yet. Shown in place of the live preview, which
   *  would only render an empty state. */
  lockedReason?: string
  onAdd: () => void
}) {
  const Icon = def.icon
  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-xl border border-border bg-canvas transition-colors duration-150',
        disabled && !lockedReason ? 'opacity-50' : !disabled && 'hover:border-border-strong',
      )}
    >
      {/* A FIXED height, not a maximum.
          `max-h` let every preview be its own size, so the gallery was a grid of
          mismatched boxes with the taller one in each row leaving a gap beside
          it — and whatever did not fit was sliced mid-line, which is why the
          radar preview ended on half of "Open radar". Now every tile is the
          same, the content is top-aligned, and anything longer fades out at the
          bottom edge rather than being cut through the middle of a word. */}
      <div className="relative h-[136px] shrink-0 overflow-hidden">
        {lockedReason ? (
          <div className="grid h-full place-items-center p-4 text-center">
            <span className="flex flex-col items-center gap-2 text-subtle">
              <Lock size={16} aria-hidden />
              <span className="text-[12px]">{lockedReason}</span>
            </span>
          </div>
        ) : (
          <div className="pointer-events-none p-2.5" inert>
            {def.render('rail')}
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-b from-transparent to-canvas"
          aria-hidden
        />
      </div>

      <div className="mt-auto flex items-start gap-2 border-t border-border bg-surface px-2.5 py-2">
        <Icon size={13} className="mt-0.5 shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-medium text-fg">{def.name}</span>
          <span className="block text-[11.5px] leading-snug text-subtle">{def.description}</span>
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onAdd}
          aria-label={lockedReason ? `${def.name}: ${lockedReason}` : `Add ${def.name}`}
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent transition-colors duration-150 hover:bg-accent hover:text-accent-contrast disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
