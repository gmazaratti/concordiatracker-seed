import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'

/**
 * A walkthrough as a silent looping clip: a GIF that happens to be an MP4.
 *
 * NO CONTROLS, NO CLICK TARGET. A control bar invites you to operate it; the
 * point is that it plays itself beside the steps you are reading. (MP4 rather
 * than a real GIF: a fraction of the weight, and no 256-colour fringing.)
 *
 * REDUCED MOTION IS HANDLED HERE IN JS. The global CSS rule zeroes animation
 * durations and has no opinion about a <video>, which would loop underneath it
 * forever. With the preference set the clip does not autoplay, and it gets
 * `controls` in that one case, because a poster with no way to start it is a
 * dead end rather than a considerate default.
 */
export function TutorialClip({
  src,
  poster,
  label,
  className,
}: {
  src: string
  poster?: string
  label: string
  className?: string
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <video
      src={src}
      poster={poster}
      autoPlay={!reduced}
      controls={reduced}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      className={className ?? 'block w-full rounded-xl border border-border'}
    />
  )
}
