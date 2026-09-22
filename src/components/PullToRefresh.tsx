import { Loader2, ArrowDown } from 'lucide-react'
import { usePullToRefresh } from '@/app/hooks/usePullToRefresh'
import { cn } from '@/lib/cn'

/**
 * Wraps a list and reloads it when you drag down from the top.
 *
 * The indicator sits in reserved space that grows with the pull rather than
 * floating over the content, so nothing under it jumps when the gesture
 * starts and nothing is covered while it runs.
 */
export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => void | Promise<void>
  children: React.ReactNode
  className?: string
}) {
  const { ref, pull, busy, ready } = usePullToRefresh<HTMLDivElement>(onRefresh)

  return (
    <div ref={ref} className={className}>
      <div
        className="grid place-items-center overflow-hidden text-subtle"
        // Height, not transform: the content below should move down with the
        // indicator, which is what makes the gesture feel attached to the
        // list rather than played over it.
        style={{ height: busy ? 40 : pull, transition: pull === 0 ? 'height 180ms ease-out' : undefined }}
        aria-hidden={pull === 0 && !busy}
      >
        {busy ? (
          <Loader2 size={17} className="animate-spin text-accent" aria-label="Refreshing" />
        ) : (
          pull > 4 && (
            <ArrowDown
              size={17}
              className={cn(
                'transition-transform duration-150',
                ready ? 'rotate-180 text-accent' : 'text-subtle',
              )}
              aria-hidden
            />
          )
        )}
      </div>
      {children}
    </div>
  )
}
