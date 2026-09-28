import { cn } from '@/lib/cn'
import { SIZE_LABEL, type WidgetSize } from './registry'

/**
 * Small / Medium / Wide, on a card in edit mode.
 *
 * Only the sizes the widget was designed for are offered, and a widget with
 * one size shows nothing: a control whose other options are all disabled is a
 * control that can only say no.
 */
export function SizePicker({
  sizes,
  value,
  onChange,
  name,
}: {
  sizes: WidgetSize[]
  value: WidgetSize
  onChange: (next: WidgetSize) => void
  name: string
}) {
  if (sizes.length < 2) return null
  return (
    <div
      role="radiogroup"
      aria-label={`Size of ${name}`}
      className="flex gap-0.5 rounded-lg border border-border-strong bg-surface p-0.5 shadow-lg"
    >
      {sizes.map((sz) => (
        <button
          key={sz}
          type="button"
          role="radio"
          aria-checked={value === sz}
          title={SIZE_LABEL[sz]}
          onClick={() => onChange(sz)}
          className={cn(
            'grid h-6 min-w-6 place-items-center rounded-md px-1.5 text-[11px] font-semibold transition-colors duration-150',
            value === sz ? 'bg-accent text-accent-contrast' : 'text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          {sz.toUpperCase()}
        </button>
      ))}
    </div>
  )
}
