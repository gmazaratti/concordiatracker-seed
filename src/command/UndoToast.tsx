import { Undo2, X } from 'lucide-react'
import { useQuickActions } from '@/app/providers/quick-actions'

/** The Gmail-style transient confirmation: an action just happened, here's a
 * brief window to take it back. Auto-dismisses (timer owned by the provider);
 * keyed remount restarts the entrance on each new flash. */
export function UndoToast() {
  const { undo, dismissUndo } = useQuickActions()
  if (!undo) return null

  return (
    <div
      key={undo.key}
      className="ct-animate-pop fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:bottom-6"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2 shadow-2xl">
        <span className="text-[13px] text-fg">{undo.label}</span>
        <button
          type="button"
          onClick={() => {
            undo.run()
            dismissUndo()
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          <Undo2 size={13} aria-hidden />
          Undo
        </button>
        <button
          type="button"
          onClick={dismissUndo}
          aria-label="Dismiss"
          className="grid size-6 place-items-center rounded-md text-subtle transition-colors hover:text-fg"
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  )
}
