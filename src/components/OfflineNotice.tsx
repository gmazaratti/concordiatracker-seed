import { CloudOff, RefreshCw, WifiOff } from 'lucide-react'
import { useOfflineState, useOnline } from '@/lib/offline-state'
import { formatTime } from '@/lib/date'

/**
 * What the app says when the network is gone. Two shapes, for two situations.
 *
 * OfflineBanner — there IS a saved copy, so the app works and shows it. One
 * line says so, and says the one thing that matters for acting on it: edits
 * will not save. It turns into "Back online · Refresh" when the connection
 * returns, because the copy on screen is now the old one.
 *
 * OfflineScreen — nothing saved on this device yet (a first launch in
 * airplane mode). An empty Today would read as "you have nothing due", which
 * is the one wrong answer this product cannot give, so the whole screen says
 * what is actually true instead.
 */
export function OfflineBanner() {
  const offline = useOfflineState()
  const online = useOnline()
  if (!offline?.savedAt) return null
  const when = formatTime(new Date(offline.savedAt))
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-[12.5px] text-fg"
    >
      {online ? (
        <>
          <RefreshCw size={14} className="shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">Back online. This is your term as of {when}.</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="shrink-0 rounded-md bg-accent px-2.5 py-1 text-[12px] font-semibold text-accent-contrast"
          >
            Refresh
          </button>
        </>
      ) : (
        <>
          <WifiOff size={14} className="shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 flex-1">
            You&rsquo;re offline. Showing your term as of {when}. Changes won&rsquo;t save until you&rsquo;re back.
          </span>
        </>
      )}
    </div>
  )
}

export function OfflineScreen() {
  const online = useOnline()
  return (
    <div className="grid h-[100dvh] place-items-center bg-canvas px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-surface-2 text-subtle">
          <CloudOff size={22} aria-hidden />
        </span>
        <h1 className="font-display text-[20px] font-medium text-fg">
          {online ? 'Connection is back' : 'You’re offline'}
        </h1>
        <p className="text-[13px] leading-relaxed text-muted">
          {online
            ? 'Load your term now.'
            : 'Nothing is saved on this device yet. Once you open ConcordiaTracker with a connection, your deadlines stay readable here offline.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          <RefreshCw size={14} aria-hidden />
          Try again
        </button>
      </div>
    </div>
  )
}
