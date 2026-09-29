import { keyboardState, raisesKeyboard } from './keyboard-viewport.ts'

/**
 * The visible area, as CSS variables (see index.css for what each means).
 * Started once from initNative, in the app AND in a browser.
 *
 * WHY THE VISUAL VIEWPORT, in both places. iOS never shrinks the LAYOUT
 * viewport for the keyboard: it shrinks the visual one and, in Safari, pans it
 * to reveal the field, dragging the whole page (header, messages) up out of
 * view. Sizing the shell to the visual viewport and pinning it to its
 * `offsetTop` leaves Safari nothing to pan and puts the composer on the
 * keyboard. The accessory bar (‹ › ✓) and Safari's AutoFill strip are OS
 * chrome that sits INSIDE the area the visual viewport excludes, so a shell
 * sized to it ends above them by construction; no website can remove the bar,
 * and nothing here tries to.
 *
 * In the app the web view is never resized natively (see MainViewController),
 * so this is the only thing that moves the layout. In a browser it only acts
 * while keyboardState says an on-screen keyboard is up (touch pointer, a text
 * field focused, zoom at 1): otherwise the variables are REMOVED and the page
 * uses its own CSS, so desktop and pinch-zoom are untouched.
 *
 * rAF-coalesced: iOS fires `resize` and `scroll` many times per keyboard
 * animation and one write per frame is all layout can use. Only variables and
 * one class change, on <html>, so the page reflows through CSS rather than
 * React re-renders. Runs for the life of the page, so there is no cleanup.
 */
export function trackViewport(native: boolean) {
  const root = document.documentElement
  const vv = window.visualViewport
  const coarse = window.matchMedia?.('(pointer: coarse)')
  let frame = 0
  let engaged = false
  let kbOpen = false
  /**
   * The tallest visible height seen with no text field focused, i.e. with no
   * keyboard. The reference the keyboard is measured against, because iOS can
   * report `innerHeight` already shrunk to the visible area while the keyboard
   * is up (see keyboard-viewport.ts). Reset when the WIDTH changes, which is a
   * rotation or a window resize, not a keyboard.
   */
  let resting = 0
  let restingWidth = window.innerWidth

  const write = () => {
    frame = 0
    const typing = raisesKeyboard(document.activeElement as HTMLInputElement | null)
    const visible = vv ? vv.height : window.innerHeight
    if (window.innerWidth !== restingWidth) {
      restingWidth = window.innerWidth
      resting = 0
    }
    if (!typing) resting = Math.max(resting, visible)
    const s = keyboardState({
      native,
      layoutHeight: Math.max(document.documentElement.clientHeight, window.innerHeight, resting),
      vvHeight: vv ? vv.height : null,
      vvTop: vv ? vv.offsetTop : null,
      vvScale: vv ? vv.scale : null,
      coarse: !!coarse?.matches,
      typing,
    })
    if (s.engaged) {
      engaged = true
      root.style.setProperty('--ct-app-h', `${s.height}px`)
      root.style.setProperty('--ct-app-top', `${s.top}px`)
      root.style.setProperty('--ct-kb', `${s.keyboard}px`)
    } else if (engaged) {
      engaged = false
      root.style.removeProperty('--ct-app-h')
      root.style.removeProperty('--ct-app-top')
      root.style.removeProperty('--ct-kb')
    }
    const open = s.engaged && s.keyboard > 0
    if (open !== kbOpen) {
      kbOpen = open
      root.classList.toggle('ct-kb-open', open)
      // Safari may have scrolled the DOCUMENT to reveal the field before the
      // lock applied; with the shell sized to what is visible there is
      // nothing to reveal, so put the page back where the layout expects it.
      if (open && !native && window.scrollY !== 0) window.scrollTo(0, 0)
    }
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(write)
  }

  write()
  window.addEventListener('resize', schedule)
  vv?.addEventListener('resize', schedule)
  vv?.addEventListener('scroll', schedule)
  // Focus changes before the keyboard's resize arrives (and a blur can land
  // after it), so re-read on both.
  if (!native) {
    document.addEventListener('focusin', schedule)
    document.addEventListener('focusout', schedule)
  }
}
