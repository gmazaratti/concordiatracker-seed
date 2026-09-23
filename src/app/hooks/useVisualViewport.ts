import { useEffect, useState } from 'react'

export interface ViewportBox {
  /** Where the visible area starts, in layout-viewport pixels. */
  top: number
  /** How tall the visible area is. */
  height: number
  /** How much of the screen the on-screen keyboard is covering, or 0. */
  keyboard: number
  /** False until we have measured, so a caller can fall back to plain CSS. */
  ready: boolean
}

/** A URL bar or a pinch is not a keyboard; a floor keeps them out of it. */
const KEYBOARD_FLOOR = 80

/**
 * The part of the screen you can actually see.
 *
 * WHY A FIXED OVERLAY IS NOT ENOUGH. `position: fixed` pins an element to the
 * LAYOUT viewport, and iOS does not shrink that for the keyboard — it shrinks
 * the VISUAL viewport and then scrolls it, which drags everything upward
 * including fixed elements. That is why opening the comment composer took the
 * whole page up and out of frame: nothing was broken, the browser was showing
 * a different part of an unchanged page.
 *
 * THE ANSWER IS TO PIN TO THE VISUAL VIEWPORT INSTEAD, by giving the overlay a
 * real `top` and `height` from `visualViewport`. Then the overlay covers
 * exactly what is on screen whatever Safari does, the background behind it
 * cannot appear to move because it is covered, and the sheet's own flex layout
 * puts the composer at the visible bottom with no second transform to keep in
 * step with the first.
 *
 * `top` RATHER THAN A TRANSFORM, deliberately. A transform on an element makes
 * it the containing block for every `position: fixed` descendant — the bug that
 * rendered the full-screen chat as a 343x44 sliver — and these dialogs contain
 * portalled pickers that rely on being fixed to the viewport.
 */
export function useVisualViewport(enabled = true): ViewportBox {
  const [box, setBox] = useState<ViewportBox>(() => ({
    top: 0,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
    keyboard: 0,
    ready: false,
  }))

  useEffect(() => {
    if (!enabled) return
    const vv = typeof window !== 'undefined' ? window.visualViewport : undefined

    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      // iOS fires resize and scroll together, many times, while the keyboard
      // animates; one read per frame is plenty.
      frame = requestAnimationFrame(() => {
        const height = vv ? vv.height : window.innerHeight
        const top = vv ? vv.offsetTop : 0
        const covered = window.innerHeight - (height + top)
        setBox({
          top: Math.round(top),
          height: Math.round(height),
          keyboard: covered > KEYBOARD_FLOOR ? Math.round(covered) : 0,
          // Without the API there is nothing to pin to, so a caller that can
          // fall back to plain CSS should — `height` is still filled in for
          // the callers that cannot.
          ready: !!vv,
        })
      })
    }

    measure()
    if (!vv) {
      window.addEventListener('resize', measure)
      return () => {
        cancelAnimationFrame(frame)
        window.removeEventListener('resize', measure)
      }
    }
    // Both: the keyboard changes `height`, and scrolling while it is open
    // changes `top` without changing the height.
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    return () => {
      cancelAnimationFrame(frame)
      vv.removeEventListener('resize', measure)
      vv.removeEventListener('scroll', measure)
    }
  }, [enabled])

  return box
}
