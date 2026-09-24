import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { Card } from './cards-data'

/** What the card looked like when it was clicked, in viewport pixels. */
export type Origin = {
  card: DOMRect
  media: DOMRect
  text: DOMRect
  time: number
}

type Box = { left: number; top: number; width: number; height: number }

const DURATION = 460
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const HEADER = 76

const box = (r: DOMRect): Box => ({ left: r.left, top: r.top, width: r.width, height: r.height })

/** The expanded panel and the video's place inside it, for the current viewport. */
function target(vw: number, vh: number) {
  const side = Math.max(24, Math.round(vw * 0.03))
  const panel: Box = { left: side, top: HEADER + 12, width: vw - side * 2, height: vh - HEADER - 12 - 24 }
  const w = Math.min(960, panel.width - 96, Math.max(320, (panel.height - 330) * (580 / 330)))
  const media: Box = { left: (panel.width - w) / 2, top: 32, width: w, height: w * (330 / 580) }
  return { panel, media }
}

/**
 * A feature card, opened. DESKTOP ONLY: the caller never mounts this on a
 * touch screen, where a card that grows to fill the screen fights the page's
 * own scrolling.
 *
 * The panel starts EXACTLY where the card is (same box, same video box) and
 * transitions to its open layout, so it reads as the card itself growing: the
 * edges move out to the sides, the video travels to the top centre, and the
 * longer description fades in under it. Closing runs the same transition
 * backwards and only then unmounts, handing the stage back to the real card,
 * which was hidden meanwhile. CSS transitions only; under reduced motion the
 * global rule makes them instant and the timers still unmount.
 */
export function CardExpand({ card, origin, onClosed }: { card: Card; origin: Origin; onClosed: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'open' | 'leave'>('enter')
  const [view, setView] = useState({ w: window.innerWidth, h: window.innerHeight })
  const video = useRef<HTMLVideoElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  const close = () => setPhase('leave')

  // enter → open on the next task, so the browser paints the starting box first.
  useEffect(() => {
    const t = setTimeout(() => setPhase('open'), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase !== 'leave') return
    const t = setTimeout(onClosed, DURATION)
    return () => clearTimeout(t)
  }, [phase, onClosed])

  // Pick the video up where the card's was, so it does not restart on open.
  useLayoutEffect(() => {
    if (video.current) video.current.currentTime = origin.time
  }, [origin.time])

  useEffect(() => {
    closeBtn.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhase('leave')
    }
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight })
    // Hold the page still underneath, without the scrollbar vanishing and the
    // whole layout jumping sideways by its width.
    const html = document.documentElement
    const gap = window.innerWidth - html.clientWidth
    const prev = { overflow: html.style.overflow, pad: html.style.paddingRight }
    html.style.overflow = 'hidden'
    html.style.paddingRight = `${gap}px`
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      html.style.overflow = prev.overflow
      html.style.paddingRight = prev.pad
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const open = phase === 'open'
  const to = target(view.w, view.h)
  const panel = open ? to.panel : box(origin.card)
  const media = open
    ? to.media
    : {
        left: origin.media.left - origin.card.left,
        top: origin.media.top - origin.card.top,
        width: origin.media.width,
        height: origin.media.height,
      }
  const move = `left ${DURATION}ms ${EASE}, top ${DURATION}ms ${EASE}, width ${DURATION}ms ${EASE}, height ${DURATION}ms ${EASE}, border-radius ${DURATION}ms ${EASE}`

  return createPortal(
    <div data-theme="dark" className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={card.title}>
      {/* Clicking anywhere outside the panel closes it. */}
      <div
        className="absolute inset-0 bg-black/70 transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0 }}
        onClick={close}
      />
      <div
        className="absolute overflow-hidden bg-[#161616] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        style={{ ...panel, borderRadius: open ? 24 : 18, transition: move }}
      >
        <video
          ref={video}
          src={card.video}
          autoPlay
          muted
          loop
          playsInline
          className="absolute rounded-[8px] bg-black object-cover"
          style={{ ...media, transition: move }}
        />

        {/* The card's own words, fading out as it opens and back in as it closes. */}
        <div
          className="pointer-events-none absolute transition-opacity duration-200"
          style={{
            left: origin.text.left - origin.card.left,
            top: origin.text.top - origin.card.top,
            width: origin.text.width,
            opacity: phase === 'enter' ? 1 : 0,
          }}
          aria-hidden
        >
          <p className="text-[38px] leading-[1.06] font-bold tracking-[-0.045em] text-white">{card.title}</p>
          <p className="mt-3.5 text-[16px] leading-[1.2] text-[#8b8b8b]">{card.body}</p>
        </div>

        <div
          className="absolute inset-x-0 overflow-y-auto px-12 pb-10"
          style={{
            top: to.media.top + to.media.height + 28,
            bottom: 0,
            opacity: open ? 1 : 0,
            transform: open ? 'none' : 'translateY(12px)',
            transition: open
              ? `opacity 320ms ease ${DURATION - 160}ms, transform 320ms ${EASE} ${DURATION - 160}ms`
              : 'opacity 120ms ease, transform 120ms ease',
          }}
        >
          <div className="mx-auto max-w-[760px] text-center">
            <h3 className="text-[34px] leading-[1.08] font-bold tracking-[-0.045em] text-white">{card.title}</h3>
            {card.detail.map((d) => (
              <p key={d} className="mt-4 text-[17px] leading-[1.45] text-[#b4b4b4]">
                {d}
              </p>
            ))}
          </div>
        </div>

        <button
          ref={closeBtn}
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white transition-[background-color,opacity] duration-200 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-accent"
          style={{ opacity: open ? 1 : 0 }}
        >
          <X size={18} aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  )
}
