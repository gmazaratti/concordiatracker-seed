import { useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Nudge } from '@/lib/discovery'
import { cn } from '@/lib/cn'
import { useDiscovery } from './useDiscovery'
import { NudgeIcon } from './NudgeIcon'

const DELAY_MS = 3500
const EXIT_MS = 240

/**
 * The occasional "did you know" popup.
 *
 * Designed to be noticed, not to interrupt: it drops in at the top centre, like
 * a phone notification, a few seconds after you land, takes no focus, blocks nothing, and never appears on
 * your first day or twice in a day (rules in lib/discovery.ts, popupFor). It
 * waits while any dialog is open, and it is recorded as shown the moment it
 * appears, so a reload never replays it.
 *
 * The nudge is FROZEN once shown: marking it popped changes the ranking, and
 * without the freeze the popup would swap its own text a second after arriving.
 */
export function DiscoveryPopup() {
  const { popup, follow, dismiss, markPopped } = useDiscovery()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [shown, setShown] = useState<Nudge | null>(null)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(false)
  const swipeY = useRef<number | null>(null)

  const waiting = !shown && !!popup && pathname.startsWith('/app')
  useEffect(() => {
    if (!waiting || !popup || done.current) return
    let timer = window.setTimeout(function tryShow() {
      // Never on top of something the student is in the middle of.
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        timer = window.setTimeout(tryShow, 4000)
        return
      }
      done.current = true
      setShown(popup)
      markPopped(popup.id)
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [waiting, popup, markPopped])

  if (!shown) return null

  const close = (after?: () => void) => {
    setLeaving(true)
    window.setTimeout(() => {
      setShown(null)
      after?.()
    }, EXIT_MS)
  }

  return (
    <aside
      onPointerDown={(e) => {
        if (e.pointerType === 'touch') swipeY.current = e.clientY
      }}
      onPointerUp={(e) => {
        // Flick it up and away, the way a phone notification is dismissed.
        if (swipeY.current !== null && swipeY.current - e.clientY > 36) close()
        swipeY.current = null
      }}
      role="status"
      aria-live="polite"
      aria-label="A feature you have not tried"
      className={cn(
        // Top centre on every screen, like a phone notification. Centred with
        // auto margins, not a translate: the entrance animates `transform`.
        'ct-discover-pop ct-beam fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-40 mx-auto max-w-[440px] overflow-hidden rounded-2xl border border-accent/25 bg-surface md:top-5',
        leaving && 'ct-discover-out',
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <span className="ct-discover-icon grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
          <NudgeIcon icon={shown.icon} size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-accent uppercase">Did you know</p>
          <p className="mt-0.5 pr-6 text-[15px] leading-snug font-semibold text-fg">{shown.title}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{shown.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <button
              type="button"
              onClick={() => {
                follow(shown.id)
                close(() => navigate(shown.to))
              }}
              className="group inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              {shown.cta}
              <ArrowRight size={14} className="transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                dismiss(shown.id)
                close()
              }}
              className="text-[12.5px] text-subtle transition-colors duration-150 hover:text-fg"
            >
              Not for me
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => close()}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 grid size-8 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <X size={15} aria-hidden />
        </button>
      </div>
    </aside>
  )
}
