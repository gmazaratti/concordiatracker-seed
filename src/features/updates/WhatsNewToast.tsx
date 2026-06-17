import { useEffect } from 'react'
import { Megaphone, X } from 'lucide-react'
import { useUpdates } from '@/app/providers/updates'

const AUTO_DISMISS = 6000

/** The transient "what's new" nudge: one line, bottom-right, auto-dismisses after
 * a few seconds, click to open the full notes, X to dismiss. Sits above the
 * mobile bottom nav. CSS-only entrance (reduced-motion safe via the global
 * duration-zero block); the auto-dismiss is a plain timer, unaffected by motion
 * settings. The persistent dot lives elsewhere, so dismissing this never hides
 * the update — it only closes the toast. */
export function WhatsNewToast() {
  const { currentVersion, openHistory, dismissToast } = useUpdates()

  useEffect(() => {
    const id = window.setTimeout(dismissToast, AUTO_DISMISS)
    return () => window.clearTimeout(id)
  }, [dismissToast])

  return (
    <div
      className="ct-animate-pop fixed right-4 bottom-20 z-[60] md:bottom-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex max-w-[20rem] items-center gap-2 rounded-xl border border-border bg-surface-2 py-2 pr-2 pl-3 shadow-2xl">
        <button
          type="button"
          onClick={openHistory}
          className="group flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
            <Megaphone size={15} aria-hidden />
          </span>
          <span className="min-w-0 text-[13px] text-fg">
            New in <span className="font-semibold">v{currentVersion}</span>
            <span className="text-muted"> — see what's changed</span>
          </span>
        </button>
        <button
          type="button"
          onClick={dismissToast}
          aria-label="Dismiss update notification"
          className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface hover:text-fg"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </div>
  )
}
