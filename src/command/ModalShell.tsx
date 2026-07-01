import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** The shared popup shell for quick-action detail views: a centered dialog
 * (bottom sheet on mobile) with backdrop dismissal, Escape to close, a focus
 * trap, scroll lock, and focus restore. CSS-only entrance, reduced-motion safe. */
export function ModalShell({
  label,
  onClose,
  children,
  widthClass = 'sm:max-w-md',
  scroll = true,
}: {
  label: string
  onClose: () => void
  children: React.ReactNode
  /** Override the dialog's max width (default sm:max-w-md). */
  widthClass?: string
  /** When true (default) children live in a single scroll wrapper. Set false to
   * let the child own its own layout (e.g. a pinned header/footer with only the
   * middle scrolling, so the scrollbar never grazes the rounded corners). */
  scroll?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<Element | null>(null)

  useEffect(() => {
    restoreRef.current = document.activeElement
    document.body.style.overflow = 'hidden'
    const id = requestAnimationFrame(() => {
      const first = ref.current?.querySelector<HTMLElement>(FOCUSABLE)
      // preventScroll so focusing a far-down control doesn't jump the modal to
      // the bottom on open.
      ;(first ?? ref.current)?.focus({ preventScroll: true })
    })
    return () => {
      cancelAnimationFrame(id)
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
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
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

  return (
    <div
      className="ct-animate-fade fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:items-center sm:p-4 sm:pb-4"
      onMouseDown={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'ct-animate-pop w-full overflow-hidden rounded-t-2xl border border-border bg-surface shadow-2xl outline-none sm:rounded-2xl',
          widthClass,
        )}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {/* Scroll lives on an inner wrapper so the scrollbar is clipped to the
            rounded corners (the outer box owns the radius + overflow-hidden).
            When `scroll` is false the child owns its own layout instead. */}
        {scroll ? (
          <div className="max-h-[85vh] overflow-y-auto">{children}</div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
