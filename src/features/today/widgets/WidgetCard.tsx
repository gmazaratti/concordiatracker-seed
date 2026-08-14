import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * The shared frame every Today widget sits in.
 *
 * Matches GlanceStrip's recessed treatment (`bg-surface/50`) rather than a solid
 * Card on purpose: the due list is the only solid surface on this screen, and it
 * stays the thing your eye lands on no matter how many widgets are added.
 */
export function WidgetCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string
  icon?: LucideIcon
  /** Optional control on the header row, e.g. a stop switcher. */
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn('overflow-hidden rounded-xl border border-border/60 bg-surface/50', className)}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3.5 py-2.5">
        {Icon && <Icon size={13} className="shrink-0 text-subtle" aria-hidden />}
        <h2 className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-subtle uppercase">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

/** The calm "nothing to show" line, so a widget never renders as a blank box. */
export function WidgetEmpty({ children }: { children: React.ReactNode }) {
  return <p className="px-3.5 py-3 text-[12.5px] leading-relaxed text-subtle">{children}</p>
}
