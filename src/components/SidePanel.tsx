import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'

/** Matches `.ct-panel-right-out`. One number, so the CSS and the unmount
 *  cannot drift into a flash of an already-gone panel. */
const EXIT_MS = 200

/**
 * A sheet down the right edge on a desktop, the whole screen on a phone — the
 * notifications panel's shape, lifted out so the member sidebar and the
 * organizer's notifications are the same object rather than two lookalikes.
 *
 * LEAVING IS AN ANIMATION TOO, and it unmounts on a TIMER rather than on
 * `animationend`: the reduced-motion rule zeroes every duration, and an event
 * at 0ms is a race the panel would sometimes lose and stay on screen.
 *
 * The body is a render prop so a child can close the panel THROUGH the exit
 * animation (e.g. after removing somebody) rather than snapping it away.
 */
export function SidePanel({
  label,
  title,
  onClose,
  actions,
  className,
  children,
}: {
  /** What a screen reader announces. */
  label: string
  title: React.ReactNode
  onClose: () => void
  /** Sits beside the title on the right. */
  actions?: React.ReactNode
  className?: string
  children: (close: () => void) => React.ReactNode
}) {
  const reduced = usePrefersReducedMotion()
  const [leaving, setLeaving] = useState(false)
  const close = () => {
    if (leaving) return
    if (reduced) return onClose()
    setLeaving(true)
    setTimeout(onClose, EXIT_MS)
  }
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(close)

  return createPortal(
    <>
      {/* Desktop only: the sheet does not cover the page, so there has to be
          something to click past it. On a phone it IS the page. */}
      <div
        className={cn('fixed inset-0 z-[79] hidden bg-black/50 md:block', leaving && 'ct-scrim-out')}
        onClick={close}
        aria-hidden
      />
      <div
        ref={ref}
        onKeyDown={onKeyDown}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={cn(
          'fixed z-[80] flex flex-col bg-canvas outline-none',
          leaving ? 'ct-panel-right-out' : 'ct-panel-right',
          'inset-0 h-[100dvh] touch-pan-y',
          'md:inset-y-0 md:left-auto md:h-full md:w-[26rem] md:border-l md:border-border md:shadow-2xl',
          className,
        )}
      >
        <header className="flex shrink-0 items-center gap-1 px-2 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 md:px-5 md:pt-4">
          <button
            type="button"
            onClick={close}
            aria-label="Back"
            className="grid size-9 shrink-0 place-items-center rounded-full text-fg transition-colors duration-150 hover:bg-surface-2 md:hidden"
          >
            <ArrowLeft size={22} aria-hidden />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-[17px] font-bold text-fg md:text-[19px]">{title}</h2>
          {actions}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="hidden size-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg md:grid"
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {children(close)}
        </div>
      </div>
    </>,
    document.body,
  )
}
