import { useEffect, useRef, useState } from 'react'
import { FileText, Sparkles } from 'lucide-react'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import type { Provenance } from '@/data/types'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'
import { ParseRevealDemo } from './ParseRevealDemo'
import { COMM221_PARSED, type Phase } from './parse-demo-data'

const PROVENANCE_LEGEND: { provenance: Provenance; copy: string }[] = [
  { provenance: { status: 'official' }, copy: 'Pulled straight from the posted syllabus.' },
  { provenance: { status: 'confirmed', confirmations: 7 }, copy: 'Cross-checked by classmates who took it.' },
  { provenance: { status: 'unverified' }, copy: 'Entered once — flagged until corroborated.' },
]

const NEXT: Partial<Record<Phase, Phase>> = {
  reach: 'grab',
  grab: 'drag',
  drag: 'drop',
  drop: 'scanning',
  scanning: 'revealing',
}

/** Anchor points (relative to the section) the overlay animates between. */
type Coords = { wordX: number; wordY: number; bedX: number; bedY: number }
type Spot = { x: number; y: number; s: number; op: number }

/** The syllabus parse-reveal as a marketing beat. On scroll-in a cursor glides in,
 * clicks the word "syllabus" in the heading, pulls a PDF out of it, and drags it
 * down into the scanner — which then scans the page and cascades the extracted
 * plan. The cursor + dragged PDF are decorative overlays whose style is computed
 * from `phase` + measured anchor points (declarative, so React owns the style and
 * CSS transitions animate the moves); they line up with the real heading word and
 * the real scanner across viewports. */
export function ParseShowcase() {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('armed')
  const [revealed, setRevealed] = useState(0)
  const [coords, setCoords] = useState<Coords | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLSpanElement>(null)
  const scannerRef = useRef<HTMLDivElement>(null)

  // Measure the word + scanner anchor points (and keep them fresh on resize).
  useEffect(() => {
    const measure = () => {
      const root = rootRef.current
      const word = wordRef.current
      const scanner = scannerRef.current
      if (!root || !word || !scanner) return
      const cR = root.getBoundingClientRect()
      const wR = word.getBoundingClientRect()
      const sR = scanner.getBoundingClientRect()
      setCoords({
        wordX: wR.left + wR.width / 2 - cR.left,
        wordY: wR.top + wR.height / 2 - cR.top,
        bedX: sR.left + sR.width / 2 - cR.left,
        bedY: sR.top + sR.height * 0.56 - cR.top,
      })
    }
    const id = setTimeout(measure, 0) // deferred → no setState in effect body
    window.addEventListener('resize', measure)
    return () => {
      clearTimeout(id)
      window.removeEventListener('resize', measure)
    }
  }, [])

  // Arm on scroll-in (once). IntersectionObserver is primary; a scroll/resize
  // bounding-box check backstops contexts where IO callbacks aren't serviced.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let started = false
    const vh = () => window.innerHeight || document.documentElement.clientHeight || 0
    const inView = () => {
      const r = el.getBoundingClientRect()
      return r.top < vh() * 0.8 && r.bottom > 0
    }
    const start = () => {
      if (started) return
      started = true
      setPhase((p) => (p === 'armed' ? 'reach' : p))
      teardown()
    }
    const onScroll = () => {
      if (inView()) start()
    }
    let io: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => entries.some((e) => e.isIntersecting) && start(),
        { threshold: 0.3 },
      )
      io.observe(el)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const initial = setTimeout(onScroll, 0)
    function teardown() {
      clearTimeout(initial)
      io?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    return teardown
  }, [])

  // Phase machine. Per-phase dwell (ms); reduced motion collapses to ~0.
  useEffect(() => {
    const dwell = (p: Phase): number => {
      switch (p) {
        case 'reach': return reduced ? 0 : 700
        case 'grab': return reduced ? 0 : 600
        case 'drag': return reduced ? 0 : 900
        case 'drop': return reduced ? 0 : 480
        case 'scanning': return reduced ? 160 : 1000
        default: return 0
      }
    }
    const next = NEXT[phase]
    if (next) {
      const t = setTimeout(() => setPhase(next), dwell(phase))
      return () => clearTimeout(t)
    }
    if (phase === 'revealing') {
      if (revealed < COMM221_PARSED.length) {
        const t = setTimeout(
          () => setRevealed((r) => r + 1),
          revealed === 0 ? 0 : reduced ? 0 : 230,
        )
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setPhase('done'), reduced ? 100 : 480)
      return () => clearTimeout(t)
    }
  }, [phase, revealed, reduced])

  const grabbing = phase === 'grab' || phase === 'drag'
  const cur = coords && cursorSpot(phase, coords)
  const pdf = coords && pdfSpot(phase, coords)
  const trans = transFor(phase)

  return (
    <section id="how" className="scroll-mt-20 border-t border-border/60 px-5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div ref={rootRef} className="relative">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted">
              <Sparkles size={13} className="text-accent" />
              The hero move
            </span>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.05] font-medium text-fg">
              Drop your{' '}
              <span
                ref={wordRef}
                className={cn(
                  'underline decoration-dashed decoration-2 underline-offset-4 transition-colors duration-200',
                  grabbing ? 'text-accent decoration-accent/60' : 'decoration-border-strong',
                )}
              >
                syllabus
              </span>
              .
              <br />
              Watch it become a plan.
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
              Upload the PDF and every deadline, weight, and exam lifts off the page
              into your term — dated, weighted, and ready to track. No copying into a
              calendar by hand.
            </p>
          </div>

          <ParseRevealDemo phase={phase} revealed={revealed} scannerRef={scannerRef} />

          {/* Cursor + dragged PDF — decorative overlays positioned from `coords` */}
          {!reduced && pdf && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 z-20"
              style={{
                left: pdf.x,
                top: pdf.y,
                opacity: pdf.op,
                transform: `translate(-50%, -50%) scale(${pdf.s})`,
                transition: trans,
              }}
            >
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 shadow-xl">
                <span className="grid size-6 shrink-0 place-items-center rounded bg-danger/15 text-danger">
                  <FileText size={13} aria-hidden />
                </span>
                <span className="text-[11px] font-medium text-fg">syllabus.pdf</span>
              </div>
            </div>
          )}

          {!reduced && cur && (
            <div
              aria-hidden
              className="pointer-events-none absolute top-0 left-0 z-30"
              style={{
                left: cur.x,
                top: cur.y,
                opacity: cur.op,
                transform: `scale(${cur.s})`,
                transition: trans,
              }}
            >
              {phase === 'grab' && (
                <span className="ct-click-ping absolute -top-1 -left-1 size-7 rounded-full bg-accent/40" />
              )}
              <svg
                width="22"
                height="22"
                viewBox="0 0 20 20"
                className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
              >
                <path
                  d="M2 2l5.6 14 2.2-5.9 5.9-2.2L2 2z"
                  fill="#fff"
                  stroke="rgba(0,0,0,0.55)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>

        {/* Provenance system */}
        <div className="mt-16 max-w-2xl">
          <h3 className="font-display text-[clamp(1.4rem,3vw,2rem)] leading-tight font-medium text-fg">
            Every date carries its receipts.
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Dates aren't all equal, so we never pretend they are. A provenance badge
            rides every deadline, so you always know how much to trust it.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {PROVENANCE_LEGEND.map(({ provenance, copy }, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5">
              <ProvenanceBadge provenance={provenance} />
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/** Cursor tip target (x,y), scale, and opacity per phase. */
function cursorSpot(phase: Phase, c: Coords): Spot {
  switch (phase) {
    case 'reach': return { x: c.wordX + 5, y: c.wordY + 7, s: 1, op: 1 }
    case 'grab': return { x: c.wordX + 5, y: c.wordY + 7, s: 0.9, op: 1 }
    case 'drag': return { x: c.bedX, y: c.bedY, s: 0.92, op: 1 }
    case 'drop': return { x: c.bedX + 8, y: c.bedY + 12, s: 1, op: 0 }
    case 'armed': return { x: c.wordX + 30, y: c.wordY + 46, s: 1, op: 0 }
    default: return { x: c.bedX, y: c.bedY, s: 1, op: 0 }
  }
}

/** PDF centre target (x,y), scale, and opacity per phase. */
function pdfSpot(phase: Phase, c: Coords): Spot {
  switch (phase) {
    case 'grab': return { x: c.wordX, y: c.wordY, s: 1, op: 1 }
    case 'drag': return { x: c.bedX, y: c.bedY, s: 1, op: 1 }
    case 'drop': return { x: c.bedX, y: c.bedY + 4, s: 0.85, op: 0 }
    case 'armed':
    case 'reach': return { x: c.wordX, y: c.wordY, s: 0.6, op: 0 }
    default: return { x: c.bedX, y: c.bedY, s: 0.85, op: 0 }
  }
}

function transFor(phase: Phase): string {
  switch (phase) {
    case 'reach':
      return 'left 600ms cubic-bezier(0.3,0,0.2,1), top 600ms cubic-bezier(0.3,0,0.2,1), transform 600ms cubic-bezier(0.3,0,0.2,1), opacity 380ms ease'
    case 'drag':
      return 'left 780ms cubic-bezier(0.4,0,0.2,1), top 780ms cubic-bezier(0.4,0,0.2,1), transform 780ms cubic-bezier(0.4,0,0.2,1), opacity 220ms ease'
    case 'grab':
      return 'transform 180ms ease-out, opacity 240ms ease'
    default:
      return 'left 320ms ease, top 320ms ease, transform 320ms ease, opacity 320ms ease'
  }
}
