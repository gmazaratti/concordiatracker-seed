import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A single big reach number (shared by the Overview + Insights tabs). */
export function Stat({
  icon: Icon,
  label,
  value,
  primary,
}: {
  icon: LucideIcon
  label: string
  value: number
  primary?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3.5',
        primary ? 'border-border bg-surface' : 'border-border/60 bg-surface/50',
      )}
    >
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <Icon size={14} className={primary ? 'text-accent' : 'text-subtle'} aria-hidden />
        {label}
      </div>
      <p className="mt-1 font-display text-[22px] font-semibold text-fg tabular-nums">
        {value.toLocaleString()}
      </p>
    </div>
  )
}

/** A compact inline metric (icon + number) used on event cards/rows. */
export function Metric({
  icon: Icon,
  value,
  title,
  muted,
}: {
  icon: LucideIcon
  value: number
  title: string
  muted?: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1" title={title}>
      <Icon size={13} className={muted ? 'text-subtle' : 'text-accent'} aria-hidden />
      {value.toLocaleString()}
    </span>
  )
}
