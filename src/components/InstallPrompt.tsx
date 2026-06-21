import { useEffect, useState, useSyncExternalStore } from 'react'
import { Plus, Share, X } from 'lucide-react'
import {
  canPromptInstall,
  isIOSSafari,
  isStandalone,
  promptInstall,
  subscribeInstall,
} from '@/lib/pwa-install'
import { cn } from '@/lib/cn'

const DISMISS_KEY = 'ct_install_dismissed'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000 // re-offer after two weeks
const REVEAL_DELAY = 4000 // let the user land + engage before nudging

function dismissedRecently(): boolean {
  try {
    const when = Number(localStorage.getItem(DISMISS_KEY))
    return when > 0 && Date.now() - when < DISMISS_MS
  } catch {
    return false
  }
}

/**
 * Tasteful "add to your home screen" nudge for engaged, not-yet-installed users.
 * Mounted inside the app shell so it only reaches signed-in students, and only
 * after a short delay. Android / desktop Chromium get a one-tap Install button
 * (the captured `beforeinstallprompt`); iOS Safari — which has no programmatic
 * install — gets the manual Share → "Add to Home Screen" steps. Never shown when
 * already installed (standalone) or recently dismissed.
 */
export function InstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall, () => false)
  const ios = isIOSSafari()
  const [gone, setGone] = useState(() => isStandalone() || dismissedRecently())
  const [shown, setShown] = useState(false)

  const eligible = !gone && (canPrompt || ios)

  useEffect(() => {
    if (!eligible) return
    const t = setTimeout(() => setShown(true), REVEAL_DELAY)
    return () => clearTimeout(t)
  }, [eligible])

  if (!eligible || !shown) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* localStorage unavailable — just hide for this session */
    }
    setGone(true)
  }

  const install = async () => {
    const accepted = await promptInstall()
    if (accepted) setGone(true)
    else dismiss() // declined the native dialog — don't nag again for a while
  }

  return (
    <div
      role="region"
      aria-label="Install ConcordiaTracker"
      className={cn(
        'ct-onboard-in fixed left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2',
        'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5',
        'rounded-2xl border border-border bg-surface/95 p-4 shadow-[var(--ct-shadow)] backdrop-blur',
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-subtle transition-colors hover:text-fg"
      >
        <X size={16} aria-hidden />
      </button>

      <div className="flex items-start gap-3">
        <img src="/icon-192.png" alt="" className="size-11 shrink-0 rounded-xl" />
        <div className="min-w-0 pr-4">
          <p className="text-[14px] font-semibold text-fg">Install ConcordiaTracker</p>
          {ios ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              Tap{' '}
              <Share
                size={13}
                className="inline -translate-y-px text-accent"
                aria-label="the Share icon"
              />{' '}
              in the toolbar, then{' '}
              <span className="font-medium text-fg">Add to Home&nbsp;Screen</span>{' '}
              <Plus size={13} className="inline -translate-y-px" aria-hidden /> for a faster,
              full-screen app.
            </p>
          ) : (
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              Add it to your home screen for a faster, full-screen experience — no app store needed.
            </p>
          )}
        </div>
      </div>

      {!ios && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors hover:text-fg"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={install}
            className="rounded-lg bg-accent px-3.5 py-1.5 text-[13px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
          >
            Install
          </button>
        </div>
      )}
    </div>
  )
}
