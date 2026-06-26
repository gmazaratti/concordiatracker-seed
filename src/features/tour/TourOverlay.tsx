import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { useTour } from './tour'
import { cn } from '@/lib/cn'

interface Box {
  top: number
  left: number
  right: number
  bottom: number
  width: number
  height: number
}

const PAD = 6 // spotlight padding around the target
const TIP_W = 280
const GAP = 12

/**
 * The visual layer of the guided tour: dims the screen with a spotlight cut out
 * around the current step's target (clip-path, so only the target stays clickable)
 * and shows a tooltip beside it. Steps with no target render a centered card.
 * Read steps advance on Space/→/Next; action steps also advance when the target
 * is used. Esc skips. Spotlight follows scroll/layout (rAF). Reduced-motion is
 * handled by the global duration-zero block (the tooltip uses ct-animate-pop).
 */
export function TourOverlay() {
  const { active, step, index, total, next, back, end } = useTour()
  const [box, setBox] = useState<Box | null>(null)

  // Keep the spotlight pinned to the target through navigation / scroll / layout.
  // All setState happens inside the rAF tick (deferred), never in the effect body.
  useEffect(() => {
    if (!active) return
    let raf = 0
    const sel = step?.target
    const tick = () => {
      const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null
      if (el) {
        const r = el.getBoundingClientRect()
        setBox(
          r.width > 0
            ? { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
            : null,
        )
      } else {
        setBox(null)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, step?.target, step?.id])

  // Keyboard: Space/→/Enter advance, ← back, Esc skip.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        back()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        end()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, next, back, end])

  // Action steps advance when the user actually uses the highlighted element.
  useEffect(() => {
    if (!active || step?.type !== 'action' || !step.target) return
    const onClick = (e: MouseEvent) => {
      const el = document.querySelector(step.target as string)
      if (el && e.target instanceof Node && el.contains(e.target)) {
        // let the real click do its thing first, then advance
        setTimeout(next, 350)
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [active, step?.type, step?.target, step?.id, next])

  if (!active || !step) return null

  // Tooltip position: under the target if there's room, else above; centered when
  // there's no target (or it isn't on screen yet).
  let tipStyle: React.CSSProperties
  let caretX = TIP_W / 2
  let caretTop = true
  if (box) {
    const below = box.bottom + GAP
    const placeAbove = below + 150 > window.innerHeight && box.top - GAP - 150 > 0
    const left = Math.max(12, Math.min(box.left + box.width / 2 - TIP_W / 2, window.innerWidth - TIP_W - 12))
    caretX = box.left + box.width / 2 - left
    if (placeAbove) {
      tipStyle = { left, bottom: window.innerHeight - box.top + GAP, width: TIP_W }
      caretTop = false
    } else {
      tipStyle = { left, top: below, width: TIP_W }
      caretTop = true
    }
  } else {
    tipStyle = { left: '50%', top: '50%', width: TIP_W, transform: 'translate(-50%, -50%)' }
  }

  const L = box ? Math.max(0, box.left - PAD) : 0
  const T = box ? Math.max(0, box.top - PAD) : 0
  const R = box ? box.right + PAD : 0
  const B = box ? box.bottom + PAD : 0
  const clip = box
    ? `polygon(0% 0%, 0% 100%, ${L}px 100%, ${L}px ${T}px, ${R}px ${T}px, ${R}px ${B}px, ${L}px ${B}px, ${L}px 100%, 100% 100%, 100% 0%)`
    : undefined

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {/* Dimmer — clipped so only the spotlight stays interactive */}
      <div
        className="absolute inset-0 bg-black/55"
        style={clip ? { clipPath: clip } : undefined}
        onClick={() => {
          /* swallow clicks on the dimmed area */
        }}
      />
      {/* Spotlight ring */}
      {box && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent/80"
          style={{ top: T, left: L, width: R - L, height: B - T }}
          aria-hidden
        />
      )}

      {/* Tooltip */}
      <div
        role="dialog"
        aria-label={step.title}
        className="ct-animate-pop fixed z-[71] rounded-xl border border-border bg-surface p-4 shadow-[var(--ct-shadow)]"
        style={tipStyle}
      >
        {box && (
          <span
            className={cn(
              'absolute size-3 rotate-45 border-border bg-surface',
              caretTop ? 'border-t border-l' : 'border-r border-b',
            )}
            style={
              caretTop
                ? { top: -6, left: Math.max(10, Math.min(caretX - 6, TIP_W - 22)) }
                : { bottom: -6, left: Math.max(10, Math.min(caretX - 6, TIP_W - 22)) }
            }
            aria-hidden
          />
        )}

        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-semibold text-fg">{step.title}</p>
          <button
            type="button"
            onClick={end}
            aria-label="Skip tour"
            className="-mt-1 -mr-1.5 grid size-6 shrink-0 place-items-center rounded text-subtle transition-colors hover:text-fg"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{step.body}</p>
        {step.type === 'action' && box && (
          <p className="mt-1.5 text-[12px] font-medium text-accent">Try it — or hit Next to continue.</p>
        )}

        <div className="mt-3.5 flex items-center justify-between gap-3">
          <span className="text-[11px] text-subtle tabular-nums">
            {index + 1} of {total}
          </span>
          <div className="flex items-center gap-1.5">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="rounded-lg px-2.5 py-1 text-[12px] font-medium text-subtle transition-colors hover:text-fg"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-accent-contrast transition-colors hover:bg-accent-hover"
            >
              {index + 1 === total ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
