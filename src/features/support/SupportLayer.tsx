import { useSupport } from '@/app/providers/support'
import { SupportModal } from './SupportModal'

/** App-level mount for the support panel, alongside the settings and
 * quick-action layers, so it opens over whatever screen you're on. Mounted only
 * while open so the ticket list is refetched each time rather than going stale. */
export function SupportLayer() {
  const { open, closeSupport } = useSupport()
  if (!open) return null
  return <SupportModal onClose={closeSupport} />
}
