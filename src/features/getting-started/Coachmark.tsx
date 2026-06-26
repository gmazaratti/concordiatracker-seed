import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { cn } from '@/lib/cn'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

/**
 * A one-time, on-brand coachmark anchored under a target element (found by
 * selector). Shown once per user (tracked in ui_state.tipsSeen); "Got it" or the
 * X dismisses it for good. Re-queries the target on navigation so it appears on
 * the right screen and stays pinned through scroll. Renders nothing if the target
 * isn't on the current page.
 */
export function Coachmark({
  id,
  selector,
  title,
  body,
}: {
  id: string
  selector: string
  title: string
  body: string
}) {
  const { loaded, isTipSeen, markTipSeen } = useUiState()
  const location = useLocation()
  const [rect, setRect] = useState<Rect | null>(null)

  const active = loaded && !isTipSeen(id)

  useEffect(() => {
    if (!active) return
    let raf = 0
    const measure = () => {
      const el = document.querySelector(selector) as HTMLElement | null
      if (!el) {
        setRect(null)
        return
      }
      const r = el.getBoundingClientRect()
      // Only anchor when the target is actually in view.
      const visible = r.top >= 0 && r.top <= window.innerHeight - 40 && r.width > 0
      setRect(visible ? { top: r.top, left: r.left, width: r.width, height: r.height } : null)
    }
    const t = setTimeout(measure, 600) // let the page settle first
    const onMove = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      clearTimeout(t)
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [active, selector, location.pathname])

  if (!active || !rect) return null

  const W = 264
  const gap = 10
  const left = Math.max(12, Math.min(rect.left + rect.width / 2 - W / 2, window.innerWidth - W - 12))
  const top = rect.top + rect.height + gap
  const caretX = rect.left + rect.width / 2 - left

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      className="ct-animate-pop fixed z-[60] rounded-xl border border-border bg-surface p-3.5 shadow-[var(--ct-shadow)]"
      style={{ top, left, width: W }}
    >
      <span
        className="absolute size-3 rotate-45 border-t border-l border-border bg-surface"
        style={{ top: -6, left: Math.max(10, Math.min(caretX - 6, W - 22)) }}
        aria-hidden
      />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold text-fg">{title}</p>
        <button
          type="button"
          onClick={() => markTipSeen(id)}
          aria-label="Dismiss tip"
          className={cn('-mt-1 -mr-1.5 grid size-6 shrink-0 place-items-center rounded text-subtle transition-colors hover:text-fg')}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{body}</p>
      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={() => markTipSeen(id)}
          className="rounded-lg bg-accent px-3 py-1 text-[12px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
        >
          Got it
        </button>
      </div>
    </div>,
    document.body,
  )
}
