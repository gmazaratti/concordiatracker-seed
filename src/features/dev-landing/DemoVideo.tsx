import type { ReactNode } from 'react'
import { Clapperboard } from 'lucide-react'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'
import { useDevCopy } from './copy'

/**
 * A product demo clip that behaves like an animated diagram: muted, looping,
 * inline, no control bar.
 *
 * REDUCED MOTION: the global CSS rule zeroes animations and has no opinion
 * about a <video>, which would loop forever underneath it. So the clip does not
 * autoplay when the preference is set, and gets `controls` in that one case, the
 * same rule as the Moodle walkthrough clip.
 *
 * NO `src` YET: renders `fallback` (the live in-page demo) inside the same
 * frame, or a quiet placeholder if there is none, tagged with the slot name so
 * the owner can see which file is still missing.
 */
export function DemoVideo({
  src,
  poster,
  aspect = 16 / 10,
  label,
  fallback,
  className,
}: {
  src?: string
  poster?: string
  aspect?: number
  label: string
  fallback?: ReactNode
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const copy = useDevCopy()

  return (
    <div
      className={cn('relative w-full overflow-hidden rounded-2xl border border-border bg-canvas', className)}
      style={{ aspectRatio: String(aspect) }}
    >
      {src ? (
        <video
          src={src}
          poster={poster || undefined}
          autoPlay={!reduced}
          controls={reduced}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={label}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <>
          {fallback ?? (
            <div className="ct-grid-plain absolute inset-0 grid place-items-center">
              <span className="flex items-center gap-2 text-[13px] text-subtle">
                <Clapperboard size={16} aria-hidden />
                {copy.slot}: {label}
              </span>
            </div>
          )}
          {/* Shown in production too while this page is a hidden draft: the
              owner reviews it on the live site. Remove when it ships. */}
          {fallback && (
            <span className="pointer-events-none absolute right-2.5 bottom-2.5 z-10 flex items-center gap-1.5 rounded-md border border-border bg-canvas/85 px-2 py-1 text-[10.5px] text-subtle backdrop-blur">
              <Clapperboard size={11} aria-hidden />
              {copy.slot}: {label}
            </span>
          )}
        </>
      )}
    </div>
  )
}
