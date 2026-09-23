import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Where you were on every page you have been.
 *
 * THE PROBLEM IT SOLVES. The whole app scrolls inside one `<main>`, which
 * never unmounts — so going from a feed you had scrolled a long way down to a
 * profile arrived mid-page, and coming back landed on whatever the profile
 * had left behind. Neither is where you were. On a feed, losing your place is
 * the difference between carrying on and starting again.
 *
 * KEYED ON `location.key`, not on the path. A key is unique to a HISTORY
 * ENTRY, so visiting the same feed twice in one session has two positions and
 * Back restores the right one; two entries for `/app/community` would
 * otherwise share, and overwrite, a single number.
 *
 * FORWARD GOES TO THE TOP, BACK GOES WHERE YOU WERE. A pushed page is one you
 * have not read, so it starts at the beginning; a popped one is one you were
 * reading. A SEARCH-ONLY change (`?event=`, `?c=`) is not a new page at all —
 * it opens an overlay over the one you are on — so it leaves the scroller
 * alone rather than yanking the page underneath to the top.
 *
 * RESTORING WAITS FOR THE CONTENT. A lazy route or a list that is still
 * loading is too short to scroll to 3,000px, and a single attempt silently
 * lands at the bottom of whatever exists. It retries until the page is tall
 * enough, then stops — with an upper bound, so a page that never grows back
 * cannot leave a loop running.
 *
 * ON A TIMER, NOT `requestAnimationFrame`. rAF does not run in a background
 * tab, so a restore that begins as the tab is hidden would stall and land at
 * the top — and a headless pane with a frozen timeline never runs one at all,
 * which is also what makes this testable.
 */

const positions = new Map<string, number>()
/** A session's worth of history, not a leak. Oldest first, so trimming from
 *  the front drops the entries furthest behind you. */
const MAX_ENTRIES = 50
/** ~1s of trying, at roughly a frame apart. */
const RESTORE_TRIES = 60
const RESTORE_STEP = 16
/** A trailing save: often enough to survive a crash, rare enough to be free. */
const SAVE_DELAY = 120

function remember(key: string, y: number) {
  positions.delete(key)
  positions.set(key, y)
  if (positions.size > MAX_ENTRIES) {
    const oldest = positions.keys().next().value
    if (oldest !== undefined) positions.delete(oldest)
  }
}

export function useScrollMemory(ref: RefObject<HTMLElement | null>) {
  const { key, pathname } = useLocation()
  const navType = useNavigationType()
  const lastPath = useRef<string | null>(null)
  /*
   * THE LAST POSITION WE SAW, not the one the scroller is showing now.
   *
   * Leaving a page removes its content, and a scroller whose content has just
   * become shorter than its offset is CLAMPED by the browser during the same
   * commit — before a single effect runs. Reading `scrollTop` on the way out
   * therefore records 0 for every long page, which is exactly what it did:
   * a correct save of 900 followed by a clamped save of 0 over the top of it.
   * A scroll event is delivered asynchronously, so this ref still holds the
   * real number when the cleanup asks for it.
   */
  const lastY = useRef(0)

  /*
   * A LAYOUT EFFECT, AND DECLARED FIRST — this is the whole thing working or
   * not.
   *
   * As a passive effect it saved ZERO every time. React's commit order is:
   * every layout cleanup, every layout effect, then the passive ones. So the
   * restore effect below had already run `el.scrollTop = 0` for the page you
   * were arriving at before this one's cleanup got to read the position of
   * the page you were leaving — it faithfully recorded the number the reset
   * had just written.
   *
   * In the layout phase, and declared above the restore, the cleanup for the
   * old entry runs before the effect that moves the scroller.
   */
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    lastY.current = el.scrollTop
    let timer = 0
    const save = () => {
      lastY.current = el.scrollTop
      clearTimeout(timer)
      timer = window.setTimeout(() => remember(key, lastY.current), SAVE_DELAY)
    }
    el.addEventListener('scroll', save, { passive: true })
    return () => {
      clearTimeout(timer)
      // The last position before leaving is the one worth keeping, and a
      // trailing save that has not fired yet would lose it.
      remember(key, lastY.current)
      el.removeEventListener('scroll', save)
    }
  }, [ref, key])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const samePage = lastPath.current === pathname
    const first = lastPath.current === null
    lastPath.current = pathname

    if (navType === 'POP') {
      const y = positions.get(key)
      if (y !== undefined && y > 0) {
        let tries = 0
        let timer = 0
        const settle = () => {
          el.scrollTop = y
          lastY.current = el.scrollTop
          // Done when the page is tall enough for that offset to be real.
          if (el.scrollTop >= y - 1 || tries++ > RESTORE_TRIES) return
          timer = window.setTimeout(settle, RESTORE_STEP)
        }
        settle()
        return () => clearTimeout(timer)
      }
    }
    // A first paint is already at the top; scrolling it there again would
    // fight a page that deliberately opened at an anchor.
    if (!samePage && !first) {
      el.scrollTop = 0
      lastY.current = 0
    }
  }, [ref, key, pathname, navType])
}
