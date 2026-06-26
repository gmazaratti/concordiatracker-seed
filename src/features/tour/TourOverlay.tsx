import { useEffect, useRef, useState } from 'react'
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

const PAD = 8 // spotlight padding around the target

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The visual layer of the guided tour. Instead of a small floating tooltip it
 * uses a DOCKED PANEL — a full-height sidebar on desktop (docked on the side
 * opposite the highlight so it never covers it) and a bottom sheet on mobile —
 * with large, readable copy, a progress bar, and Back (bottom-left) / Next
 * (bottom-right). The current target is spotlit (dim + clip-path cutout, so only
 * it stays interactive) and auto-scrolled into view once per step, so nothing is
 * ever left out of frame. Read steps advance on Space/→/Next; action steps also
 * advance on the real interaction; Esc skips. Reduced-motion safe.
 */
export function TourOverlay() {
  const { active, step, index, total, next, back, end } = useTour()
  const [box, setBox] = useState<Box | null>(null)
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const scrolledFor = useRef<string | null>(null)

  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Measure the target each frame (follows scroll/layout) and, once per step,
  // scroll it into view so it's never out of frame. All setState is inside the
  // rAF tick — never synchronously in the effect body.
  useEffect(() => {
    if (!active) return
    let raf = 0
    const sel = step?.target
    const tick = () => {
      const el = sel ? (document.querySelector(sel) as HTMLElement | null) : null
      if (el) {
        if (scrolledFor.current !== step?.id) {
          scrolledFor.current = step?.id ?? null
          el.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: reduceMotion() ? 'auto' : 'smooth',
          })
        }
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
      if (el && e.target instanceof Node && el.contains(e.target)) setTimeout(next, 350)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [active, step?.type, step?.target, step?.id, next])

  if (!active || !step) return null

  const mobile = vp.w < 768
  // Dock opposite the highlight so the panel never covers it.
  const side = !box ? 'right' : box.left + box.width / 2 > vp.w / 2 ? 'left' : 'right'

  const L = box ? Math.max(0, box.left - PAD) : 0
  const T = box ? Math.max(0, box.top - PAD) : 0
  const R = box ? Math.min(vp.w, box.right + PAD) : 0
  const B = box ? Math.min(vp.h, box.bottom + PAD) : 0
  const clip = box
    ? `polygon(0 0, 0 100%, ${L}px 100%, ${L}px ${T}px, ${R}px ${T}px, ${R}px ${B}px, ${L}px ${B}px, ${L}px 100%, 100% 100%, 100% 0)`
    : undefined

  const progress = Math.round(((index + 1) / total) * 100)
  const last = index + 1 === total

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      {/* Dimmer — clipped so only the spotlight stays interactive */}
      <div
        className="absolute inset-0 bg-black/60"
        style={clip ? { clipPath: clip } : undefined}
      />
      {/* Spotlight ring */}
      {box && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent shadow-[0_0_0_5px_var(--ct-accent-soft)]"
          style={{ top: T, left: L, width: R - L, height: B - T }}
          aria-hidden
        />
      )}

      {/* Docked panel — sidebar on desktop, bottom sheet on mobile */}
      <aside
        role="dialog"
        aria-label={step.title}
        className={cn(
          'ct-animate-pop fixed z-[71] flex flex-col bg-surface shadow-2xl',
          mobile
            ? 'inset-x-0 bottom-0 max-h-[62vh] rounded-t-2xl border-t border-border px-5 pt-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]'
            : cn(
                'top-0 bottom-0 w-[400px] p-7',
                side === 'right' ? 'right-0 border-l border-border' : 'left-0 border-r border-border',
              ),
        )}
      >
        {/* Progress + skip */}
        <div className="flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={end}
            aria-label="Skip tour"
            className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
        <p className="mt-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
          Step {index + 1} of {total}
        </p>

        {/* Content — vertically centered in the desktop sidebar; scrolls if long on mobile */}
        <div
          className={cn(
            'min-h-0 py-5',
            mobile ? 'overflow-y-auto' : 'flex flex-1 flex-col justify-center',
          )}
        >
          <h2 className="font-display text-[22px] leading-tight font-semibold text-fg">
            {step.title}
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{step.body}</p>
          {step.type === 'action' && box && (
            <p className="mt-3.5 text-[13.5px] font-medium text-accent">
              Try it on the highlighted item — or hit Next to continue.
            </p>
          )}
        </div>

        {/* Footer — Back bottom-left, Next bottom-right */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={index === 0 ? end : back}
            className="rounded-lg px-3.5 py-2.5 text-[13.5px] font-medium text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            {index === 0 ? 'Skip tour' : 'Back'}
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-accent px-6 py-2.5 text-[14px] font-semibold text-accent-contrast shadow-sm transition-colors hover:bg-accent-hover"
          >
            {last ? 'Finish' : 'Next'}
          </button>
        </div>
      </aside>
    </div>,
    document.body,
  )
}
