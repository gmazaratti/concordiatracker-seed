import { useSyncExternalStore } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import {
  dismissWriteError,
  subscribeWriteErrors,
  writeErrorSnapshot,
} from '@/lib/write-errors'

/**
 * The one thing on screen when a background save did not happen.
 *
 * A TOAST, NOT A DIALOG. These are fire-and-forget writes: the work is almost
 * always still on the page, and blocking everything for something the person
 * can simply do again is its own harm. But it is visible and it names what
 * failed, which is the whole point — the alternative was a console line
 * nobody reads and a screen that says it worked.
 *
 * It sits above the mobile bar (`bottom-20 md:bottom-4`), the same place the
 * update toast learned to sit.
 */
export function WriteErrorToast() {
  const err = useSyncExternalStore(subscribeWriteErrors, writeErrorSnapshot, () => null)
  if (!err) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="ct-animate-pop fixed right-4 bottom-20 z-[130] flex max-w-[min(22rem,calc(100vw-2rem))] items-start gap-2.5 rounded-xl border border-danger/50 bg-surface px-3.5 py-3 shadow-2xl md:bottom-4"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">
          {err.what}
          {err.count > 1 && (
            <span className="ml-1.5 text-[11.5px] font-normal text-subtle">
              ×{err.count}
            </span>
          )}
        </p>
        {/* Small, and kept: it is for a bug report rather than for a fix, but
            an unfamiliar error is still better than a made-up explanation. */}
        <p className="mt-0.5 text-[11.5px] leading-snug break-words text-subtle">{err.detail}</p>
      </div>
      <button
        type="button"
        onClick={dismissWriteError}
        aria-label="Dismiss"
        className="-mr-1 grid size-6 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:text-fg"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  )
}
