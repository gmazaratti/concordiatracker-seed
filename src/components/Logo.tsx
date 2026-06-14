import { cn } from '@/lib/cn'

/** Brand mark + wordmark. The wordmark is one of the few deliberate
 *  Fraunces (display) moments; everything else in the UI stays Inter. */
export function Logo({
  showText = true,
  className,
}: {
  showText?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
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
        <span className="font-display text-[17px] leading-none font-medium text-fg">
          Concordia<span className="text-muted">Tracker</span>
        </span>
      )}
    </span>
  )
}
