import { cn } from '@/lib/cn'

/** Shared easing for the whole reel — a gentle, cinematic ease-out. */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'

/** A full-bleed scene that crossfades in/out with a hair of scale. Only opacity +
 * transform animate (GPU-composited) so screen recordings stay smooth — never
 * layout properties. All scenes stay mounted; `active` drives the crossfade. */
export function Stage({
  active,
  children,
}: {
  active: boolean
  children: React.ReactNode
}) {
  return (
    <div
      aria-hidden={!active}
      style={{ transitionTimingFunction: EASE }}
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center px-6 text-center transition-[opacity,transform] duration-700 will-change-[opacity,transform] sm:px-12',
        active
          ? 'scale-100 opacity-100'
          : 'pointer-events-none scale-[1.03] opacity-0',
      )}
    >
      {children}
    </div>
  )
}

type RevealFrom = 'up' | 'down' | 'scale' | 'none'

const HIDDEN: Record<RevealFrom, string> = {
  up: 'translate-y-6',
  down: '-translate-y-8',
  scale: 'scale-90',
  none: '',
}

/** An element inside a scene that eases in (opacity + transform only) when the
 * scene is active, honoring a per-element `delay` for staggered entrances. On
 * exit the delay drops to 0 so re-entry (Play from start) restarts cleanly. */
export function Reveal({
  active,
  delay = 0,
  from = 'up',
  className,
  children,
}: {
  active: boolean
  delay?: number
  from?: RevealFrom
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        transitionDelay: active ? `${delay}ms` : '0ms',
        transitionTimingFunction: EASE,
      }}
      className={cn(
        'transition-[opacity,transform] duration-[720ms] will-change-[opacity,transform]',
        active ? 'translate-y-0 scale-100 opacity-100' : cn('opacity-0', HIDDEN[from]),
        className,
      )}
    >
      {children}
    </div>
  )
}
