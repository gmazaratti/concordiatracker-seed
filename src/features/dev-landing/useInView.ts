import { useEffect, useState, type RefObject } from 'react'

/**
 * True once `visible` of the element's height (or of the viewport, for tall
 * elements) is on screen. One-shot: a demo that restarts every time it scrolls
 * back into view reads as a glitch.
 *
 * IntersectionObserver PLUS a scroll/resize bounding-box check, the same belt
 * and braces as the live landing's parse beat: some embedded browsers and
 * preview panes deliver scroll events but not observer callbacks, and a reveal
 * that never fires leaves a section invisible. With neither available it
 * answers true straight away.
 */
export function useInView(ref: RefObject<Element | null>, visible = 0.2): boolean {
  const [seen, setSeen] = useState(() => typeof window === 'undefined' || typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (seen) return
    const el = ref.current
    if (!el) return
    let done = false
    const hit = () => {
      if (done) return
      done = true
      setSeen(true)
    }
    const check = () => {
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const need = Math.min(r.height, vh) * visible
      if (r.top < vh - need && r.bottom > need) hit()
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) hit()
    }, { threshold: Math.min(visible, 0.99) })
    io.observe(el)
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    const first = window.setTimeout(check, 0)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      window.clearTimeout(first)
    }
  }, [ref, seen, visible])
  return seen
}
