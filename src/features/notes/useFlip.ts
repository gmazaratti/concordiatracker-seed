import { useLayoutEffect, useRef } from 'react'

/**
 * Cards glide to their new place when the order changes, instead of jumping.
 *
 * FLIP: remember where every `[data-flip]` child was, and after React moves
 * them, start each one at its old spot and animate the difference away. Only
 * transform is animated, so it stays on the compositor; reduced motion skips it.
 */
export function useFlip(container: React.RefObject<HTMLElement | null>, key: string) {
  const last = useRef(new Map<string, DOMRect>())

  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const next = new Map<string, DOMRect>()
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((child) => {
      const id = child.dataset.flip!
      const now = child.getBoundingClientRect()
      next.set(id, now)
      const before = last.current.get(id)
      if (!before || reduced) return
      const dx = before.left - now.left
      const dy = before.top - now.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      child.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      )
    })
    last.current = next
  }, [container, key])
}
