import { useEffect, useState } from 'react'

export interface ViewportBox {
  /** Height of the area the user can actually see, keyboard excluded. */
  height: number
  /** How far that area starts below the top of the layout viewport. */
  offsetTop: number
}

/**
 * The part of the screen that is actually visible, which is not `inset-0`.
 *
 * WHY `dvh` IS NOT ENOUGH. `100dvh` tracks the browser's own chrome — the
 * address bar sliding away — and that is all it tracks. **On iOS the software
 * keyboard does not shrink the layout viewport at all**, so a `fixed inset-0`
 * overlay keeps its full height and anything anchored to its bottom edge is
 * rendered underneath the keyboard, where it cannot be seen or reached.
 *
 * `window.visualViewport` is the only thing that reports the keyboard. It is
 * read here and handed back as plain numbers so a panel can be sized and
 * positioned against the visible area instead of the imaginary one.
 *
 * Falls back to `innerHeight` where the API is missing, which is the current
 * behaviour, so nothing gets worse.
 */
export function useVisualViewport(active: boolean): ViewportBox {
  const [box, setBox] = useState<ViewportBox>(() => ({
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
    offsetTop: 0,
  }))

  useEffect(() => {
    if (!active) return
    const vv = window.visualViewport
    const read = () =>
      setBox({
        height: vv ? vv.height : window.innerHeight,
        // `offsetTop` is non-zero when the page is scrolled under a keyboard
        // or pinch-zoomed; ignoring it pins the panel to the wrong place.
        offsetTop: vv ? vv.offsetTop : 0,
      })
    read()
    if (!vv) {
      window.addEventListener('resize', read)
      return () => window.removeEventListener('resize', read)
    }
    // Both: the keyboard changes `height`, and scrolling while it is open
    // changes `offsetTop` without changing the height.
    vv.addEventListener('resize', read)
    vv.addEventListener('scroll', read)
    return () => {
      vv.removeEventListener('resize', read)
      vv.removeEventListener('scroll', read)
    }
  }, [active])

  return box
}
