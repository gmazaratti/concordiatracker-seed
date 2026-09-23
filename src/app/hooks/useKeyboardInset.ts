import { useEffect, useState } from 'react'

/**
 * How many pixels of the screen the on-screen keyboard is covering.
 *
 * WHY NOT LET THE BROWSER DO IT. On iOS Safari the keyboard does not resize
 * the layout viewport at all — `100vh`, `100dvh` and `position: fixed` all
 * keep measuring the full screen, so a composer pinned to the bottom ends up
 * UNDER the keyboard. Safari's own workaround is to scroll the whole page up,
 * which drags the sheet's header and the feed behind it with it: exactly the
 * jump this is meant to stop. The visual viewport is the only thing that
 * actually knows, so we ask it and move one element ourselves.
 *
 * THE NUMBER IS `innerHeight - (visualViewport.height + offsetTop)`. Both
 * terms matter: `height` shrinks when the keyboard opens, and `offsetTop`
 * moves when Safari scrolls the page under it — subtracting only the height
 * leaves the composer floating a keyboard's worth too high the moment the
 * user scrolls with the keyboard up.
 *
 * NEGATIVE AND TINY VALUES ARE ZERO. The visual viewport also shrinks for the
 * URL bar and for a pinch-zoom, and neither is a keyboard; a floor of 80px
 * means the composer does not creep upward because somebody scrolled.
 *
 * NOTHING HAPPENS ON A DESKTOP: there is no `visualViewport` resize to speak
 * of, so the hook returns 0 and the composer stays where CSS put it.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    if (!enabled) return
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined
    if (!vv) return

    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      // Coalesced into a frame: iOS fires `resize` and `scroll` together, many
      // times, while the keyboard animates.
      frame = requestAnimationFrame(() => {
        const covered = window.innerHeight - (vv.height + vv.offsetTop)
        setInset(covered > 80 ? Math.round(covered) : 0)
      })
    }

    measure()
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', measure)
      vv.removeEventListener('scroll', measure)
    }
  }, [enabled])

  return inset
}
