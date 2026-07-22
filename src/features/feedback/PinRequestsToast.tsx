import { useState } from 'react'
import { Pin, PinOff, X } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { cn } from '@/lib/cn'

/** A small floating toast (slides up from the bottom) offering to pin the
 * requests board to the sidebar — or unpin it. Dismissible for the session, so
 * it's an invitation, not clutter. */
export function PinRequestsToast() {
  const { uiState, loaded, patchUiState } = useUiState()
  const [dismissed, setDismissed] = useState(false)
  if (!loaded || dismissed) return null
  const pinned = !!uiState.feedbackPinned

  return (
    <div className="ct-animate-pop fixed right-4 bottom-20 z-40 max-w-[calc(100vw-2rem)] md:bottom-5">
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pr-1.5 pl-3.5 shadow-[var(--ct-shadow)]">
        <span className="hidden text-[12.5px] text-muted sm:inline">
          {pinned ? 'Pinned to your sidebar' : 'Keep this handy?'}
        </span>
        <button
          type="button"
          onClick={() => patchUiState({ feedbackPinned: !pinned })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
            pinned
              ? 'text-muted hover:bg-surface-2 hover:text-fg'
              : 'bg-accent text-accent-contrast hover:bg-accent-hover',
          )}
        >
          {pinned ? (
            <>
              <PinOff size={13} aria-hidden />
              Unpin from sidebar
            </>
          ) : (
            <>
              <Pin size={13} aria-hidden />
              Pin to sidebar
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="grid size-7 shrink-0 place-items-center rounded-full text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
