import { cn } from '@/lib/cn'

/** A labeled group of rows — the calm card language from Today/Courses. */
export function Group({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-6 last:mb-1">
      <h3 className="mb-2 px-1 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        {label}
      </h3>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface-2/25">
        {children}
      </div>
    </section>
  )
}

/** One setting line: label (+ description) left, control right. `stacked` drops
 * the control to its own full-width line below (for wide controls). */
export function Row({
  label,
  description,
  children,
  stacked = false,
}: {
  label: string
  description?: string
  children?: React.ReactNode
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className="px-4 py-3.5">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        {description && <p className="mt-0.5 text-[12px] text-subtle">{description}</p>}
        {children && <div className="mt-3">{children}</div>}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-fg">{label}</p>
        {description && <p className="mt-0.5 text-[12px] text-subtle">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

/** Accessible on/off switch (in-memory — mock). */
export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5 transition-colors duration-150',
        checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-border',
      )}
    >
      <span
        className={cn(
          'size-4 rounded-full bg-white shadow-sm transition-transform duration-150',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}

/** Segmented radio control (theme/language/plan style). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex gap-1 rounded-lg border border-border bg-canvas p-1"
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md px-3 py-1 text-[12px] font-medium transition-colors duration-150',
              selected ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Small flag chip — surfaces a draft / placeholder state (used by Privacy +
 * Billing and echoed by the bracketed tags inside the legal documents). */
export function Flag({ children = 'Draft' }: { children?: React.ReactNode }) {
  return (
    <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-warning uppercase">
      {children}
    </span>
  )
}
