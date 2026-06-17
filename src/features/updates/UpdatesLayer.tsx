import { useUpdates } from '@/app/providers/updates'
import { WhatsNewToast } from './WhatsNewToast'
import { WhatsNewModal } from './WhatsNewModal'

/** App-level mount for the update affordances: the transient toast and the
 * on-demand history modal. Lives in the student chrome so it rides over whatever
 * screen is open (like the settings + quick-action layers). */
export function UpdatesLayer() {
  const { showToast, isHistoryOpen } = useUpdates()
  return (
    <>
      {showToast && <WhatsNewToast />}
      {isHistoryOpen && <WhatsNewModal />}
    </>
  )
}
