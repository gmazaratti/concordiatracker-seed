import { useEffect, useRef, useState } from 'react'
import { Check, FileText, Loader2, Sparkles, Upload } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { KIND_LABEL } from '@/lib/assessment'
import { relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'

type Phase = 'idle' | 'scanning' | 'revealing' | 'done'

/** THE hero moment. An empty course's only job is to be filled — so "uploading"
 * the syllabus runs a scripted parse: a scan line sweeps the document, then the
 * extracted dates cascade in one at a time, each with its provenance. When the
 * cascade lands, `onComplete` commits the dates to the store and the course
 * flips to its populated view. (No real parsing — the SEED fakes extraction.) */
export function SyllabusParseReveal({
  course,
  items,
  onComplete,
}: {
  course: Course
  items: Assessment[]
  onComplete: (items: Assessment[]) => void
}) {
  const reduced = usePrefersReducedMotion()
  const [phase, setPhase] = useState<Phase>('idle')
  const [revealed, setRevealed] = useState(0)
  const committed = useRef(false)

  const SCAN_MS = reduced ? 150 : 850
  const STAGGER = reduced ? 0 : 170
  const HOLD = reduced ? 120 : 600

  useEffect(() => {
    if (phase === 'scanning') {
      const t = setTimeout(() => setPhase('revealing'), SCAN_MS)
      return () => clearTimeout(t)
    }
    if (phase === 'revealing') {
      if (revealed < items.length) {
        const t = setTimeout(() => setRevealed((r) => r + 1), revealed === 0 ? 0 : STAGGER)
        return () => clearTimeout(t)
      }
      const t = setTimeout(() => setPhase('done'), HOLD)
      return () => clearTimeout(t)
    }
    if (phase === 'done' && !committed.current) {
      committed.current = true
      const t = setTimeout(() => onComplete(items), HOLD)
      return () => clearTimeout(t)
    }
  }, [phase, revealed, items, onComplete, SCAN_MS, STAGGER, HOLD])

  const scanning = phase === 'scanning'
  const parsing = phase === 'revealing' || phase === 'done'

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border bg-surface-2/40 px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
          <Sparkles size={15} className="text-accent" aria-hidden />
          Import syllabus
        </div>
        <p className="mt-0.5 text-[12px] text-subtle">
          {course.code} has no dates yet. Drop your outline and we'll lift out
          every assessment, weight, and deadline.
        </p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {/* The document being scanned */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2 p-4">
          {scanning && (
            <div
              className="ct-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-accent-soft to-transparent"
              aria-hidden
            />
          )}
          <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
            <FileText size={14} className="text-accent" aria-hidden />
            {course.code.replace(' ', '')}_outline.pdf
          </div>
          <div className="mt-3 space-y-2" aria-hidden>
            {[92, 78, 85, 64, 88, 71, 80].map((w, i) => (
              <div
                key={i}
                className="h-2 rounded-full bg-border"
                style={{ width: `${w}%` }}
              />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-subtle">
            {scanning ? (
              <>
                <Loader2 size={12} className="animate-spin text-accent" aria-hidden />
                Reading the syllabus…
              </>
            ) : parsing ? (
              <>
                <Check size={12} className="text-success" aria-hidden />
                Parsed · {items.length} dates found
              </>
            ) : (
              'Sample outline ready to parse'
            )}
          </p>
        </div>

        {/* Idle CTA, or the cascade of extracted dates */}
        <div className="flex flex-col">
          {phase === 'idle' ? (
            <div className="flex flex-1 flex-col items-start justify-center gap-3">
              <button
                type="button"
                onClick={() => setPhase('scanning')}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
              >
                <Upload size={15} aria-hidden />
                Upload &amp; parse
              </button>
              <p className="text-[12px] text-subtle">
                Contribute your outline →{' '}
                <span className="text-accent">earn theme credits</span>. Parsed
                dates land as <span className="text-prov-official">official</span>.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {items.slice(0, revealed).map((a) => (
                <li
                  key={a.id}
                  className="ct-reveal-item flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2"
                >
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    {KIND_LABEL[a.kind]}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-fg">
                    {a.title}
                  </span>
                  <span className="shrink-0 text-[11px] text-subtle">
                    {relativeDueLabel(a.due)}
                  </span>
                  <span className="shrink-0 text-[11px] font-medium text-muted tabular-nums">
                    {a.weight}%
                  </span>
                  <ProvenanceBadge provenance={a.provenance} className="shrink-0" />
                </li>
              ))}
              {revealed < items.length && (
                <li
                  className={cn(
                    'px-2.5 py-2 text-[11px] text-subtle',
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
    </Card>
  )
}
