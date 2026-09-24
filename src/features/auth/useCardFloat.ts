import { useEffect, type RefObject } from 'react'

/**
 * The sign-in panel's cards drift on their own and lean away from the cursor.
 *
 * ONE requestAnimationFrame loop moves every card. Each frame computes a
 * target offset per card: a slow ambient float (two sines on different
 * periods, with a per-card phase, so no two cards ever move together) plus,
 * on a fine pointer, a push away from the cursor that fades to nothing at
 * PUSH_RADIUS. The card's actual offset then eases toward that target with a
 * frame-rate-independent lerp, so a cursor arriving or leaving produces a
 * glide rather than a jump.
 *
 * WRITES `transform` ON A WRAPPER, not on the card, so the card's own layout
 * offsets and hover styles are untouched, and a transform never changes what
 * is clickable. Transform only, so it stays on the compositor.
 *
 * KEPT INSIDE: the offset is clamped so a card cannot leave the panel or rise
 * into the headline. The clamp is measured from the card's resting box (its
 * current box minus the offset applied to it), re-read every frame, so a
 * resize never leaves it working from stale numbers.
 *
 * `list` is the element whose direct children are the moving wrappers, so
 * the card count is whatever is rendered rather than a number kept in sync.
 *
 * No motion at all under reduced motion (the OS setting or the in-app one):
 * the loop never starts and the cards sit where the layout put them. Touch
 * and pen get the ambient drift only, because there is no cursor to avoid.
 */
const AMBIENT = 7 // px
const PUSH = 22 // px, with the cursor on the card
const PUSH_RADIUS = 120 // px from the card's edge, where the push fades to zero
const EASE = 5 // per second: higher settles faster
const MARGIN = 12 // px kept clear of the panel edges and the headline

export function useCardFloat(
  panelRef: RefObject<HTMLElement | null>,
  headRef: RefObject<HTMLElement | null>,
  listRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const panel = panelRef.current
    const list = listRef.current
    if (!panel || !list) return
    const cards = Array.from(list.children) as HTMLElement[]
    const count = cards.length
    const reduced =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.hasAttribute('data-reduce-motion')
    if (reduced) return

    const fine = window.matchMedia('(pointer: fine)')
    const pos = Array.from({ length: count }, () => ({ x: 0, y: 0 }))
    // Phases and periods per card, fixed rather than random so the motion is
    // the same on every visit and nothing depends on a clock read in render.
    const phase = [0, 2.1, 4.3, 1.2, 3.4]
    const period = [
      [7.3, 9.1],
      [8.6, 6.7],
      [6.2, 8.4],
    ]
    let cursor: { x: number; y: number } | null = null
    let raf = 0
    let last = performance.now()

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || !fine.matches) return
      cursor = { x: e.clientX, y: e.clientY }
    }
    const onLeave = () => {
      cursor = null
    }
    panel.addEventListener('pointermove', onMove)
    panel.addEventListener('pointerleave', onLeave)

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const t = now / 1000
      const k = 1 - Math.exp(-EASE * dt)
      const box = panel.getBoundingClientRect()
      const head = headRef.current?.getBoundingClientRect()
      const top = Math.max(box.top, head ? head.bottom : box.top) + MARGIN

      cards.forEach((el, i) => {
        const p = pos[i]
        const [px, py] = period[i % period.length]
        const ph = phase[i % phase.length]
        let tx = Math.sin((t * Math.PI * 2) / px + ph) * AMBIENT
        let ty = Math.cos((t * Math.PI * 2) / py + ph) * AMBIENT

        // The resting box, i.e. where the layout put the card.
        const r = el.getBoundingClientRect()
        const rest = { left: r.left - p.x, top: r.top - p.y, right: r.right - p.x, bottom: r.bottom - p.y }

        if (cursor) {
          // Strength from the distance to the card's NEAREST EDGE (zero once
          // the cursor is over it), direction from the cursor to its centre.
          // Measuring to the centre made a wide card barely react: a cursor
          // already on its edge is still 170px from the middle.
          const ex = Math.max(rest.left - cursor.x, 0, cursor.x - rest.right)
          const ey = Math.max(rest.top - cursor.y, 0, cursor.y - rest.bottom)
          const edge = Math.hypot(ex, ey)
          if (edge < PUSH_RADIUS) {
            const dx = (rest.left + rest.right) / 2 - cursor.x
            const dy = (rest.top + rest.bottom) / 2 - cursor.y
            const d = Math.hypot(dx, dy) || 1
            const f = (1 - edge / PUSH_RADIUS) ** 2 * PUSH
            tx += (dx / d) * f
            ty += (dy / d) * f
          }
        }

        tx = Math.min(Math.max(tx, box.left + MARGIN - rest.left), box.right - MARGIN - rest.right)
        ty = Math.min(Math.max(ty, top - rest.top), box.bottom - MARGIN - rest.bottom)

        p.x += (tx - p.x) * k
        p.y += (ty - p.y) * k
        el.style.transform = `translate3d(${p.x.toFixed(2)}px, ${p.y.toFixed(2)}px, 0)`
      })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      panel.removeEventListener('pointermove', onMove)
      panel.removeEventListener('pointerleave', onLeave)
      cards.forEach((el) => {
        el.style.transform = ''
      })
    }
  }, [panelRef, headRef, listRef])
}
