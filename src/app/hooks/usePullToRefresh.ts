import { useEffect, useRef, useState } from 'react'

/**
 * Drag down from the top of a scroller to reload it.
 *
 * TOUCH ONLY, deliberately. On a mouse there is already a way to reload and
 * hijacking the wheel at the top of a list is the behaviour every embedded
 * map gets complained about. Same call as the schedule grid's drag, which is
 * mouse-only for the mirror-image reason.
 *
 * IT ONLY ARMS AT THE VERY TOP. If the scroller has moved at all the gesture
 * is a scroll, and treating an over-scroll bounce as a refresh is how this
 * feature ends up firing when somebody is just reading.
 *
 * The distance is damped, so pulling 200px moves the indicator ~66 and the
 * gesture feels like it is resisting rather than tracking — the same
 * rubber-band shape the platform uses, and the reason a short accidental
 * drag never reaches the threshold.
 */

const THRESHOLD = 64
const MAX = 96
const DAMP = 0.4

export function usePullToRefresh<T extends HTMLElement>(
  onRefresh: () => void | Promise<void>,
  enabled = true,
) {
  const ref = useRef<T | null>(null)
  const [pull, setPull] = useState(0)
  const [busy, setBusy] = useState(false)
  // Read inside the listener so a re-render does not have to re-bind it.
  // Assigned in an effect, not during render: `react-hooks/refs` bars
  // touching .current while rendering, and it is right to — a ref written
  // during render is a value React cannot see change.
  const cb = useRef(onRefresh)
  useEffect(() => {
    cb.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let startY: number | null = null
    let armed = false

    /*
     * THE WRAPPER ITSELF COUNTS. This used to start at `el.parentElement`,
     * which was fine while every list scrolled with the page — but the
     * conversation list is now its own scroll region and the wrapper IS that
     * region. Walking straight past it found `window`, whose scrollTop is
     * permanently 0 on a page that does not scroll, so the gesture armed
     * halfway down a list and refreshed on an ordinary swipe.
     */
    const scroller = (): HTMLElement | Window => {
      let p: HTMLElement | null = el
      while (p) {
        const oy = getComputedStyle(p).overflowY
        if (oy === 'auto' || oy === 'scroll') return p
        p = p.parentElement
      }
      return window
    }

    const atTop = () => {
      const s = scroller()
      return s === window ? window.scrollY <= 0 : (s as HTMLElement).scrollTop <= 0
    }

    const onStart = (e: TouchEvent) => {
      if (busy || e.touches.length !== 1) return
      armed = atTop()
      startY = armed ? e.touches[0].clientY : null
    }

    const onMove = (e: TouchEvent) => {
      if (!armed || startY === null) return
      const dy = e.touches[0].clientY - startY
      // Dragging up is an ordinary scroll; let go of the gesture entirely.
      if (dy <= 0) {
        setPull(0)
        armed = false
        startY = null
        return
      }
      // Still at the top? If the list scrolled under us mid-drag this is not
      // a pull any more.
      if (!atTop()) {
        setPull(0)
        armed = false
        startY = null
        return
      }
      setPull(Math.min(MAX, dy * DAMP))
    }

    const onEnd = () => {
      if (!armed) return
      armed = false
      startY = null
      setPull((d) => {
        if (d >= THRESHOLD) {
          setBusy(true)
          void Promise.resolve(cb.current()).finally(() => {
            setBusy(false)
            setPull(0)
          })
          // Hold the indicator open while it runs.
          return THRESHOLD
        }
        return 0
      })
    }

    // `passive` on move as well: this never calls preventDefault, because the
    // browser's own overscroll is the visual we are riding on top of, and
    // cancelling it makes the page feel stuck.
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, busy])

  return { ref, pull, busy, ready: pull >= THRESHOLD }
}
