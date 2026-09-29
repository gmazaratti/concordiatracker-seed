import { useEffect, type RefObject } from 'react'

/** Within this many pixels of the end counts as "reading the latest". */
const NEAR_END = 80

/**
 * Keeps a conversation pinned to its newest message while its box changes
 * size — which is what the keyboard does to it.
 *
 * When the keyboard rises the conversation gets shorter, and a scroll box that
 * gets shorter keeps its scrollTop: the newest messages slide down behind the
 * composer, which is the opposite of every messenger. So if you were at the
 * end before the box shrank, you are put back at the end after it. If you had
 * scrolled up to read something older, nothing moves — yanking you to the
 * bottom because you tapped the field would be worse.
 *
 * `endRef` is the sentinel after the last message; its parent is the scroll
 * box. A ResizeObserver rather than a keyboard event, because the box is what
 * changed, and this way it also holds for a rotation or a split-view resize.
 */
export function useStickToBottom(endRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const box = endRef.current?.parentElement
    if (!box || typeof ResizeObserver === 'undefined') return

    let atEnd = true
    const measure = () => {
      atEnd = box.scrollHeight - box.scrollTop - box.clientHeight <= NEAR_END
    }
    measure()
    box.addEventListener('scroll', measure, { passive: true })
    const ro = new ResizeObserver(() => {
      if (atEnd) box.scrollTop = box.scrollHeight
    })
    ro.observe(box)
    return () => {
      box.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [endRef])
}
