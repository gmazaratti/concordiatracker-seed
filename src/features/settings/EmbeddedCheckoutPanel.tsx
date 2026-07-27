import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { X } from 'lucide-react'

/**
 * Stripe's payment form, mounted INSIDE the app (embedded checkout) rather than
 * bouncing the student to another tab. Card details live in Stripe's own iframe —
 * they never touch our page or our servers.
 *
 * Rendered as its OWN overlay above the settings modal, not nested inside it:
 * Stripe's form is ~800px tall and the settings panel is capped at 620px with its
 * own scroller, so nesting produced a cramped scroll-within-a-scroll. This gives
 * the form near-full height and exactly ONE scroll region.
 *
 * `loadStripe` is called once at module scope, per Stripe's guidance (calling it
 * per-render would re-download Stripe.js on every mount).
 */
const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

export function EmbeddedCheckoutPanel({
  fetchClientSecret,
  onClose,
  title = 'Checkout',
}: {
  fetchClientSecret: () => Promise<string>
  onClose: () => void
  title?: string
}) {
  // Stripe requires a stable callback; ours just forwards to the caller's fetch.
  const getSecret = useCallback(() => fetchClientSecret(), [fetchClientSecret])

  // Escape closes the checkout (and only the checkout — it's the topmost layer).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])

  if (!stripePromise) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[12.5px] text-warning">
        Payments aren&rsquo;t configured in this environment yet.
      </div>
    )
  }

  // z-60 → above the settings modal (z-50).
  return createPortal(
    <div
      className="ct-animate-fade fixed inset-0 z-[60] flex items-stretch justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Click-outside to dismiss (the card below stops propagation). */}
      <button type="button" aria-hidden tabIndex={-1} className="absolute inset-0 cursor-default" onClick={onClose} />

      <div className="ct-animate-pop relative flex h-full w-full flex-col overflow-hidden bg-surface shadow-2xl sm:h-[min(92vh,900px)] sm:max-w-[560px] sm:rounded-2xl sm:border sm:border-border">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] sm:pt-3">
          <span className="text-[14px] font-semibold text-fg">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={17} aria-hidden />
          </button>
        </header>

        {/* The ONLY scroll region. Stripe sizes its iframe to content; letting it
            grow here means one natural scroll instead of nested ones. */}
        <div className="min-h-0 flex-1 overflow-y-auto bg-white pb-[env(safe-area-inset-bottom)]">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret: getSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>,
    document.body,
  )
}
