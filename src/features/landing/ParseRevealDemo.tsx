import { useEffect, useRef, useState } from 'react'
import { Check, FileText, Loader2 } from 'lucide-react'
import type { AssessmentKind, Provenance } from '@/data/types'
import { KIND_LABEL } from '@/lib/assessment'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { cn } from '@/lib/cn'

/** Display-only filler for the landing parse beat, lifted from the real syllabus
 * the user dropped (COMM 221 GG — Financial Markets, Winter 2026). Local to the
 * landing (not in mock.ts) because its dates are the syllabus's own calendar
 * dates, not the runtime-relative dates the app's seed invariant requires. */
type ParsedItem = {
  id: string
  kind: AssessmentKind
  title: string
  weight: number
  due: string
  provenance: Provenance
}

const COMM221_PARSED: ParsedItem[] = [
  { id: 'q1', kind: 'quiz', title: 'Quiz 1 — Time value & NPV', weight: 8, due: 'Feb 8', provenance: { status: 'official' } },
  { id: 'q2', kind: 'quiz', title: 'Quiz 2 — Risk, CAPM & ESG', weight: 8, due: 'Feb 22', provenance: { status: 'official' } },
  { id: 'q3', kind: 'quiz', title: 'Quiz 3 — Markets & equilibria', weight: 8, due: 'Mar 15', provenance: { status: 'official' } },
  { id: 'q4', kind: 'quiz', title: 'Quiz 4 — Resource allocation', weight: 8, due: 'Mar 29', provenance: { status: 'official' } },
  { id: 'q5', kind: 'quiz', title: 'Quiz 5 — Finance history & regulation', weight: 8, due: 'Apr 5', provenance: { status: 'official' } },
  { id: 'final', kind: 'final', title: 'Final Common Exam', weight: 60, due: 'Apr · exam period', provenance: { status: 'confirmed', confirmations: 9 } },
]

/** The raw grade-composition table as it reads on the page — the "before" the
 * parser turns into the structured plan on the right. */
const RAW_ROWS: [string, string, string][] = [
  ['Quiz 1 (Moodle, online)', '8%', 'Feb 8'],
  ['Quiz 2 (Moodle, online)', '8%', 'Feb 22'],
  ['Quiz 3 (Moodle, online)', '8%', 'Mar 15'],
  ['Quiz 4 (Moodle, online)', '8%', 'Mar 29'],
  ['Quiz 5 (Moodle, online)', '8%', 'Apr 5'],
  ['Final Common Exam (in-person)', '60%', 'TBA'],
]

type Phase = 'armed' | 'dropping' | 'scanning' | 'revealing' | 'done'

/** Scroll-triggered recreation of the real syllabus parse-reveal, as a marketing
 * beat: the PDF drops into the scanner, a scan line sweeps the raw page, then the
 * extracted assessments cascade into a structured plan one at a time — the same
 * choreography as the in-app `SyllabusParseReveal`. Plays once, on scroll-in. */
export function ParseRevealDemo() {
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('armed')
  const [revealed, setRevealed] = useState(0)

  const DROP_MS = reduced ? 0 : 720
  const SCAN_MS = reduced ? 160 : 1000
  const STAGGER = reduced ? 0 : 230
  const HOLD = reduced ? 100 : 480

  // Arm on scroll-in (once) — the animation starts as the section enters view.
  // IntersectionObserver is the primary trigger; a scroll/resize bounding-box
  // check backstops it for any context where IO callbacks aren't serviced.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let started = false
    const vh = () => window.innerHeight || document.documentElement.clientHeight || 0
    const inView = () => {
      const r = el.getBoundingClientRect()
      return r.top < vh() * 0.85 && r.bottom > 0
    }
    const start = () => {
      if (started) return
      started = true
      setPhase((p) => (p === 'armed' ? 'dropping' : p))
      teardown()
    }
    const onScroll = () => {
      if (inView()) start()
    }
    let io: IntersectionObserver | null = null
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => entries.some((e) => e.isIntersecting) && start(),
        { threshold: 0.35 },
      )
      io.observe(el)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    // deferred initial check (already-in-view) — avoids a sync setState in effect
    const initial = setTimeout(onScroll, 0)
    function teardown() {
      clearTimeout(initial)
      io?.disconnect()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
    return teardown
  }, [])

  // Drive the phase machine on timers (gated on reduced-motion via the deltas).
  useEffect(() => {
    if (phase === 'dropping') {
      const t = setTimeout(() => setPhase('scanning'), DROP_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'scanning') {
      const t = setTimeout(() => setPhase('revealing'), SCAN_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'revealing') {
      if (revealed < COMM221_PARSED.length) {
        const t = setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? 0 : STAGGER)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setPhase('done'), HOLD)
      return () => clearTimeout(t)
    }
  }, [phase, revealed, DROP_MS, SCAN_MS, STAGGER, HOLD])

  const dropped = phase !== 'armed'
  const scanning = phase === 'scanning'
  const parsed = phase === 'revealing' || phase === 'done'
  const total = COMM221_PARSED.length

  return (
    <div
      ref={rootRef}
      className="mt-12 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      {/* The scanner — a PDF drops in, then a scan line sweeps the raw page */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4">
        {!dropped ? (
          <div className="flex min-h-[244px] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-border-strong text-subtle">
            <FileText size={22} aria-hidden />
            <span className="text-[12px]">Syllabus ready to scan</span>
          </div>
        ) : (
          <div className="ct-drop-in">
            <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
              <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-danger uppercase">
                PDF
              </span>
              Comm 221_GG_Winter 2026.pdf
            </div>

            <div className="mt-3 rounded-lg border border-border bg-canvas/50 p-3 font-mono text-[10px] leading-relaxed text-subtle">
              <p className="tracking-wide text-muted">JOHN MOLSON SCHOOL OF BUSINESS</p>
              <p>Department of Finance</p>
              <p className="mt-1.5 text-[10.5px] font-semibold text-fg">
                COMM 221 GG · Financial Markets · Winter 2026
              </p>
              <p className="mt-2.5 text-muted">Grade Composition:</p>
              <div className="mt-1 space-y-1">
                {RAW_ROWS.map(([label, w, when]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{label}</span>
                    <span className="shrink-0 tabular-nums text-muted">
                      {w} · {when}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[9px] text-subtle/80">
                *40% required on the common final to pass…
              </p>
            </div>

            {scanning && (
              <div
                className="ct-scan-sweep pointer-events-none absolute inset-x-4 top-10 h-16 rounded-full bg-gradient-to-b from-accent/0 via-accent/25 to-accent/0"
                aria-hidden
              />
            )}

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
              {scanning ? (
                <>
                  <Loader2 size={12} className="animate-spin text-accent" aria-hidden />
                  Reading the syllabus…
                </>
              ) : parsed ? (
                <>
                  <Check size={12} className="text-success" aria-hidden />
                  Parsed · {total} dates found
                </>
              ) : (
                'Dropping into the scanner…'
              )}
            </p>
          </div>
        )}
      </div>

      {/* The extracted plan — assessments cascade in one at a time */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-5 py-3">
          <span className="text-[13px] font-semibold text-fg">Financial Markets</span>
          <span className="text-[12px] text-subtle">
            {parsed ? (phase === 'done' ? `${total} dates found` : `${revealed} of ${total}`) : 'Waiting…'}
          </span>
        </div>

        {!parsed ? (
          <div className="flex min-h-[244px] items-center justify-center px-5 text-[12px] text-subtle">
            {scanning ? 'Lifting dates off the page…' : 'The plan appears as the scan completes.'}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {COMM221_PARSED.slice(0, revealed).map((a) => (
              <li key={a.id} className="ct-reveal-item flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-fg">{a.title}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-subtle">
                    <span>
                      {KIND_LABEL[a.kind]} · {a.weight}%
                    </span>
                    <ProvenanceBadge provenance={a.provenance} tone="quiet" />
                  </div>
                </div>
                <span className="shrink-0 text-[12px] font-semibold text-fg">{a.due}</span>
              </li>
            ))}
            {revealed < total && (
              <li
                className={cn(
                  'px-5 py-2.5 text-[11px] text-subtle',
                  !reduced && 'animate-pulse',
                )}
              >
                Extracting…
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
