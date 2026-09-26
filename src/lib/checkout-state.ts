import { useSyncExternalStore } from 'react'

/**
 * Whether a Stripe checkout is on screen right now. The Pro-gift celebration
 * waits while it is: throwing confetti over a card form mid-payment would be
 * confusing, and the person may be deciding whether to pay at all.
 */
let open = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

/** Call from the checkout's mount effect; returns the unmount cleanup. */
export function markCheckoutOpen(): () => void {
  open++
  emit()
  return () => {
    open = Math.max(0, open - 1)
    emit()
  }
}

export function useCheckoutOpen(): boolean {
  return useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => open > 0,
    () => false,
  )
}
