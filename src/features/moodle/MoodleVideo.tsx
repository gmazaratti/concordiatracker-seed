import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'

const SRC = '/moodle/setup.mp4'
const POSTER = '/moodle/setup-poster.jpg'

/**
 * The setup walkthrough, as a silent looping clip.
 *
 * NO CONTROLS, NO CLICK TARGET, NO CAPTION — this is a GIF that happens to be
 * an MP4. A control bar invites you to operate it; the point here is that it
 * plays itself while you read the steps beside it, the way an animated diagram
 * does. (MP4 rather than an actual GIF because the same 26 seconds is 1.2 MB
 * instead of ~25 MB, and a GIF's 256 colours fringe every label in the UI.)
 *
 * REDUCED MOTION IS HANDLED HERE IN JS. The global CSS rule zeroes animation
 * and transition durations and has no opinion about a <video>, which would
 * loop underneath it forever. When the preference is set the clip does not
 * autoplay — and it gets `controls` in that one case, because a poster with no
 * way to start it is a dead end rather than a considerate default.
 */
export function MoodleVideo() {
  const reduced = usePrefersReducedMotion()

  return (
    <video
      src={SRC}
      poster={POSTER}
      autoPlay={!reduced}
      controls={reduced}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label="The Moodle setup, start to finish"
      className="block w-full rounded-xl border border-border"
    />
  )
}
