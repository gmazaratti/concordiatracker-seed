import type { NavBadge as Badge } from '@/app/useNavBadges'
import { cn } from '@/lib/cn'

/** The count pill inside a nav tab. Red when something's overdue, accent when
 * it's merely worth a look — so colour carries the urgency, not just presence. */
export function NavBadge({ badge, className }: { badge: Badge; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-[1.15rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
        badge.tone === 'danger' ? 'bg-danger text-white' : 'bg-accent text-accent-contrast',
        className,
      )}
      aria-label={badge.label}
    >
      {badge.count > 99 ? '99+' : badge.count}
    </span>
  )
}
