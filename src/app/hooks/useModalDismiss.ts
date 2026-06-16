import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Focusable descendants that are actually visible — skips elements hidden by
 * responsive utilities (e.g. a mobile-only close button on desktop), which
 * can't take focus and would otherwise break the trap. */
function visibleFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.offsetParent !== null,
  )
}

/**
 * Shared modal a11y: on mount, remember the active element, lock body scroll, and
 * focus the first focusable inside the dialog; on unmount, restore both. Returns
 * a `ref` for the dialog and an `onKeyDown` that closes on Escape and traps Tab.
 * (The same mechanics ModalShell uses, extracted so the wider settings panel can
 * reuse them without duplicating the logic.)
 */
export function useModalDismiss<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null)
  const restoreRef = useRef<Element | null>(null)

  useEffect(() => {
    restoreRef.current = document.activeElement
    document.body.style.overflow = 'hidden'
    // Defer one tick so the dialog is laid out before we move focus into it.
    const id = setTimeout(() => {
      const first = visibleFocusable(ref.current)[0]
      ;(first ?? ref.current)?.focus()
    }, 0)
    return () => {
      clearTimeout(id)
      document.body.style.overflow = ''
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus()
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    if (e.key !== 'Tab' || !ref.current) return
    const items = visibleFocusable(ref.current)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return { ref, onKeyDown }
}
