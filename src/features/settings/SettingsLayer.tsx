import { useSettings } from '@/app/providers/settings'
import { SettingsModal } from './SettingsModal'

/** App-level mount point for the floating settings panel — lives in the student
 * chrome so it opens over whatever screen you're on (like the quick-action
 * popups). Mounted only while open so its section state is fresh each time. */
export function SettingsLayer() {
  const { open } = useSettings()
  if (!open) return null
  return <SettingsModal />
}
