import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { ArrowUpCircle, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { nativeStoreLink, versionGate, type VersionGate } from '@/lib/version-gate'

const DISMISS_KEY = 'ct_update_dismissed'
const OK: VersionGate = { kind: 'ok' }

/**
 * The installed build, or null where the check does not apply.
 *
 * NATIVE iOS ONLY. A browser always runs the deployed site, so it can never be
 * out of date and is never blocked. Dev servers may fake a build with
 * `localStorage.ct_fake_build = '3'` to see both screens; `import.meta.env.DEV`
 * is false in every production bundle, so no real user can set it.
 */
async function installedBuild(): Promise<string | null> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
    return (await App.getInfo()).build
  }
  if (import.meta.env.DEV) {
    try {
      return localStorage.getItem('ct_fake_build')
    } catch {
      return null
    }
  }
  return null
}

/** FAILS OPEN: every error, timeout or odd answer becomes 'ok'. */
async function check(): Promise<VersionGate> {
  try {
    const build = await installedBuild()
    if (build === null) return OK
    // In the app, routeApiToSite() sends this to concordiatracker.com.
    const r = await fetch('/api/app-version?platform=ios', { cache: 'no-store', signal: AbortSignal.timeout(6000) })
    if (!r.ok) return OK
    return versionGate(build, await r.json())
  } catch {
    return OK
  }
}

function dismissedFor(latest: number): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === String(latest)
  } catch {
    return false
  }
}

/**
 * The force-update check, run on launch and again whenever the app returns to
 * the foreground (a phone can sit in the background for days while the
 * minimum moves).
 *
 * Mounted above the router so a blocked build cannot get as far as signing in.
 */
export function ForceUpdateGate() {
  const [gate, setGate] = useState<VersionGate>(OK)
  const [dismissed, setDismissed] = useState<number | null>(null)

  const run = useCallback(() => {
    void check().then(setGate)
  }, [])

  useEffect(() => {
    run()
    const back = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [run])

  if (gate.kind === 'block') return <UpdateRequired storeUrl={gate.storeUrl} />
  if (gate.kind === 'soft' && dismissed !== gate.latest && !dismissedFor(gate.latest)) {
    return (
      <UpdateBanner
        storeUrl={gate.storeUrl}
        onDismiss={() => {
          try {
            localStorage.setItem(DISMISS_KEY, String(gate.latest))
          } catch {
            /* only this session then */
          }
          setDismissed(gate.latest)
        }}
      />
    )
  }
  return null
}

function storeHref(storeUrl: string) {
  return Capacitor.isNativePlatform() ? nativeStoreLink(storeUrl) : storeUrl
}

/** Full screen, above everything, and deliberately without a way out. */
function UpdateRequired({ storeUrl }: { storeUrl: string }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ct-update-title"
      aria-describedby="ct-update-body"
      className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-canvas px-6 pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+24px)] text-center"
    >
      <Logo size="lg" />
      <h1 id="ct-update-title" className="mt-10 font-display text-[26px] font-semibold tracking-tight text-fg">
        Please update
      </h1>
      <p id="ct-update-body" className="mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
        This version of ConcordiaTracker is no longer supported. Update from the App Store to keep using it. Your courses
        and grades are saved to your account and will be right where you left them.
      </p>
      <a
        href={storeHref(storeUrl)}
        target={Capacitor.isNativePlatform() ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="mt-8 inline-flex min-h-12 w-full max-w-xs items-center justify-center rounded-xl bg-accent px-6 text-[16px] font-semibold text-accent-contrast"
      >
        Update on the App Store
      </a>
    </div>
  )
}

function UpdateBanner({ storeUrl, onDismiss }: { storeUrl: string; onDismiss: () => void }) {
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+8px)] z-[140] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border bg-surface/90 py-2 pr-1.5 pl-3.5 shadow-lg backdrop-blur-xl"
    >
      <ArrowUpCircle size={20} className="shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1 text-[13.5px] text-fg">A new version of ConcordiaTracker is available.</p>
      <a
        href={storeHref(storeUrl)}
        target={Capacitor.isNativePlatform() ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-accent px-3 text-[13px] font-medium text-accent-contrast"
      >
        Update
      </a>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid size-9 shrink-0 place-items-center rounded-lg text-subtle hover:bg-surface-2 hover:text-fg"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
