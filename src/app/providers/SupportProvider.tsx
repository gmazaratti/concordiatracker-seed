import { useCallback, useEffect, useMemo, useState } from 'react'
import { SupportContext } from './support'

/**
 * Owns the support panel's open state.
 *
 * `?support=1` opens it on load, so the docs — which are static pages outside
 * the app — can hand a signed-in reader straight into their ticket list rather
 * than describing where to find it. Read from window rather than the router,
 * since this provider sits above the Router.
 */
function wantedByUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('support') !== null
  } catch {
    return false
  }
}

export function SupportProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState(wantedByUrl)
  const [open, setOpen] = useState(initial)

  // Consume the param so a reload doesn't reopen the panel forever.
  useEffect(() => {
    if (!initial) return
    const url = new URL(window.location.href)
    url.searchParams.delete('support')
    window.history.replaceState({}, '', url)
  }, [initial])

  const openSupport = useCallback(() => setOpen(true), [])
  const closeSupport = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ open, openSupport, closeSupport }),
    [open, openSupport, closeSupport],
  )

  return <SupportContext value={value}>{children}</SupportContext>
}
