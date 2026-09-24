import { useEffect, type RefObject } from 'react'

/**
 * Everything that moves on the sign-in panel, in ONE requestAnimationFrame
 * loop: the three cards (a slow float, plus a lean away from a nearby mouse)
 * and the two flow-line layers (a slow drift and a gentle opacity breath).
 *
 * COMPOSITOR ONLY. Each frame writes `transform` (and, for the line layers,
 * `opacity`) on elements that are their own layers, and nothing else, so no
 * frame repaints anything. It also READS nothing: the resting boxes are
 * measured once and again only when the panel resizes (ResizeObserver), and
 * the cursor is converted to panel coordinates in the pointer event itself.
 * The first version called getBoundingClientRect for every card on every
 * frame, interleaved with the writes, which forces a style recalculation per
 * card per frame.
 *
 * Offsets ease toward their targets with a frame-rate-independent lerp, so a
 * cursor arriving or leaving is a glide, never a jump. Cards are clamped
 * inside the panel and below the headline; transforms never change what is
 * clickable.
 *
 * CANNOT STRAND A HALF-DRAWN FRAME: the frame body is wrapped, and if it ever
 * throws the loop stops and every element is put back to its resting state
 * (no transform, full opacity) rather than left mid-motion.
 *
 * No motion at all under reduced motion (the OS setting or the in-app one).
 * Touch and pen get the ambient drift only: there is no cursor to avoid.
 */
const AMBIENT = 7 // px, card float
const PUSH = 22 // px, with the cursor on the card
const PUSH_RADIUS = 120 // px from the card's edge, where the push fades to zero
const EASE = 5 // per second: higher settles faster
const MARGIN = 12 // px kept clear of the panel edges and the headline

type Box = { left: number; top: number; right: number; bottom: number }

export function useCardFloat(
  panelRef: RefObject<HTMLElement | null>,
  headRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
  flowRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const panel = panelRef.current
    const list = listRef.current
    if (!panel || !list) return
    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.hasAttribute('data-reduce-motion')
    if (reduced) return

    const cards = Array.from(list.children) as HTMLElement[]
    const layers = flowRef.current ? (Array.from(flowRef.current.children) as HTMLElement[]) : []
    const pos = cards.map(() => ({ x: 0, y: 0 }))
    const phase = [0, 2.1, 4.3]
    const period = [
      [7.3, 9.1],
      [8.6, 6.7],
      [6.2, 8.4],
    ]

    // Resting geometry, in panel coordinates.
    let size = { w: 0, h: 0 }
    let headBottom = 0
    let rest: Box[] = []
    const measure = () => {
      const pr = panel.getBoundingClientRect()
      size = { w: pr.width, h: pr.height }
      headBottom = headRef.current ? headRef.current.getBoundingClientRect().bottom - pr.top : 0
      rest = cards.map((el, i) => {
        const r = el.getBoundingClientRect()
        return {
          left: r.left - pr.left - pos[i].x,
          top: r.top - pr.top - pos[i].y,
          right: r.right - pr.left - pos[i].x,
          bottom: r.bottom - pr.top - pos[i].y,
        }
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(panel)

    const fine = window.matchMedia('(pointer: fine)')
    let cursor: { x: number; y: number } | null = null
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !fine.matches) return
      const pr = panel.getBoundingClientRect()
      cursor = { x: e.clientX - pr.left, y: e.clientY - pr.top }
    }
    const onLeave = () => {
      cursor = null
    }
    panel.addEventListener('pointermove', onMove)
    panel.addEventListener('pointerleave', onLeave)

    const reset = () => {
      cards.forEach((el) => {
        el.style.transform = ''
      })
      layers.forEach((el) => {
        el.style.transform = ''
        el.style.opacity = ''
      })
    }

    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      try {
        const dt = Math.min(0.05, (now - last) / 1000)
        last = now
        const t = now / 1000
        const k = 1 - Math.exp(-EASE * dt)
        const TAU = Math.PI * 2

        // The two line layers: opposite-phase drift and a slow breath.
        layers.forEach((el, g) => {
          const x = Math.sin((t * TAU) / 23 + g * Math.PI) * 14
          const y = Math.cos((t * TAU) / 29 + g * 1.7) * 10
          const o = 0.78 + 0.22 * Math.sin((t * TAU) / 17 + g * 2.1)
          el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
          el.style.opacity = o.toFixed(3)
        })

        const top = Math.max(0, headBottom) + MARGIN
        cards.forEach((el, i) => {
          const b = rest[i]
          if (!b) return
          const p = pos[i]
          const [px, py] = period[i % period.length]
          const ph = phase[i % phase.length]
          let tx = Math.sin((t * TAU) / px + ph) * AMBIENT
          let ty = Math.cos((t * TAU) / py + ph) * AMBIENT

          if (cursor) {
            // Strength from the distance to the card's NEAREST EDGE (zero once
            // the cursor is over it), direction from the cursor to its centre.
            const ex = Math.max(b.left - cursor.x, 0, cursor.x - b.right)
            const ey = Math.max(b.top - cursor.y, 0, cursor.y - b.bottom)
            const edge = Math.hypot(ex, ey)
            if (edge < PUSH_RADIUS) {
              const dx = (b.left + b.right) / 2 - cursor.x
              const dy = (b.top + b.bottom) / 2 - cursor.y
              const d = Math.hypot(dx, dy) || 1
              const f = (1 - edge / PUSH_RADIUS) ** 2 * PUSH
              tx += (dx / d) * f
              ty += (dy / d) * f
            }
          }

          tx = Math.min(Math.max(tx, MARGIN - b.left), size.w - MARGIN - b.right)
          ty = Math.min(Math.max(ty, top - b.top), size.h - MARGIN - b.bottom)
          p.x += (tx - p.x) * k
          p.y += (ty - p.y) * k
          el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`
        })
        raf = requestAnimationFrame(frame)
      } catch {
        reset()
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      panel.removeEventListener('pointermove', onMove)
      panel.removeEventListener('pointerleave', onLeave)
      reset()
    }
  }, [panelRef, headRef, listRef, flowRef])
}
