import { useEffect, type RefObject } from 'react'

/**
 * The bottom-right corner is shared: the getting-started card (and its "You're
 * all set" finish), and the "what's new" toast. They used to be positioned
 * independently, so on a desktop the toast landed on top of the card.
 *
 * Whatever occupies the corner publishes its height as `--ct-corner` on the
 * root, and the toast sits that far up (WhatsNewToast). Measured with a
 * ResizeObserver, so a card that expands pushes the toast with it.
 */
export function useCornerOccupant(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const apply = () => root.style.setProperty('--ct-corner', `${el.offsetHeight + 12}px`)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.removeProperty('--ct-corner')
    }
    // No deps on purpose: the occupant can mount after the hook first runs
    // (the card renders null until it has steps), and a ref does not re-render.
  })
}
