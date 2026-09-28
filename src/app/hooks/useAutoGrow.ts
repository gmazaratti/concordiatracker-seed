import { useLayoutEffect, type RefObject } from 'react'

/**
 * A textarea that grows with what you type, so a long message can be read back
 * before it is sent instead of scrolling inside a one-line box. It stops at
 * the element's own max-height (set in CSS) and scrolls from there.
 *
 * Layout effect: the height is measured and set before paint, so typing never
 * shows a frame with the old height.
 */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [ref, value])
}
