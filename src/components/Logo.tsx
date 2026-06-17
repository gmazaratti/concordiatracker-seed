import { cn } from '@/lib/cn'

/** Brand mark + wordmark. The wordmark uses the display face (Hanken Grotesk);
 *  everything else in the UI stays Inter. `size="lg"` renders at real (not
 *  transform-scaled) dimensions so layout spacing around it stays predictable —
 *  used by the demo-reel outro. */
export function Logo({
  showText = true,
  size = 'md',
  className,
}: {
  showText?: boolean
  size?: 'md' | 'lg'
  className?: string
}) {
  const lg = size === 'lg'
  return (
    <span className={cn('inline-flex items-center', lg ? 'gap-3.5' : 'gap-2', className)}>
      <svg viewBox="0 0 32 32" className={cn('shrink-0', lg ? 'size-14' : 'size-7')} aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-surface-2" />
        <path
          d="M21.6 11.4a6.7 6.7 0 1 0 0 9.2"
          fill="none"
          className="stroke-accent"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="22.6" cy="16" r="1.8" className="fill-accent" />
      </svg>
      {showText && (
        <span
          className={cn(
            'font-display leading-none font-medium text-fg',
            lg ? 'text-[34px]' : 'text-[17px]',
          )}
        >
          Concordia<span className="text-muted">Tracker</span>
        </span>
      )}
    </span>
  )
}
