import { useCallback } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { X } from 'lucide-react'

/**
 * Stripe's payment form, mounted INSIDE Settings → Billing (embedded checkout)
 * instead of sending the student to a separate tab. Card details are entered in
 * Stripe's own iframe — they never touch our page or our servers.
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

  if (!stripePromise) {
    return (
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[12.5px] text-warning">
        Payments aren&rsquo;t configured in this environment yet.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/30 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-fg">{title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checkout"
          className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
      <div className="overflow-hidden rounded-lg bg-white">
        <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret: getSecret }}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  )
}
