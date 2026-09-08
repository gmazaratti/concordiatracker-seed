import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * A checkbox in our tokens.
 *
 * The last native control left in the app. `accent-color` gets you the fill and
 * nothing else — the box, the border and the tick still come from the OS, so on
 * a dark panel it renders as a bright system square that belongs to a different
 * product. Same reason there is no native `<select>` or `<input type="color">`
 * anywhere here.
 *
 * The real input stays in the DOM, visually hidden rather than replaced, so it
 * keeps its focus behaviour, its label association, and its place in the tab
 * order for free.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  /** Rendered beside the box. Omit only when an ancestor <label> supplies one. */
  label?: React.ReactNode
  hint?: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn('group flex cursor-pointer items-start gap-2.5', className)}>
      <span className="relative mt-px grid size-[18px] shrink-0 place-items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 cursor-pointer opacity-0"
        />
        <span
          aria-hidden
          className={cn(
            'grid size-[18px] place-items-center rounded-[5px] border transition-colors duration-150',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-canvas',
            checked
              ? 'border-accent bg-accent text-accent-contrast'
              : 'border-border-strong bg-canvas group-hover:border-accent/60',
          )}
        >
          {checked && <Check size={12} strokeWidth={3} aria-hidden />}
        </span>
      </span>
      {(label || hint) && (
        <span className="min-w-0">
          {label && <span className="block text-[12.5px] leading-snug text-muted">{label}</span>}
          {hint && <span className="mt-0.5 block text-[11px] leading-relaxed text-subtle">{hint}</span>}
        </span>
      )}
    </label>
  )
}
