import { Check, FileText, Loader2 } from 'lucide-react'
import { KIND_LABEL } from '@/lib/assessment'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { cn } from '@/lib/cn'
import { COMM221_PARSED, RAW_ROWS, type Phase } from './parse-demo-data'

/** Presentational two-column parse demo, driven by the phase machine in
 * `ParseShowcase` (which also owns the fake cursor + the PDF it drags out of the
 * heading). Left = the scanner that receives the dropped syllabus and scans it;
 * right = the extracted plan that cascades in. `scannerRef` lets the orchestrator
 * measure the bed so the dragged PDF lands in the right spot. */
export function ParseRevealDemo({
  phase,
  revealed,
  scannerRef,
}: {
  phase: Phase
  revealed: number
  scannerRef: React.Ref<HTMLDivElement>
}) {
  const scanning = phase === 'scanning'
  const parsed = phase === 'revealing' || phase === 'done'
  const showRaw = scanning || parsed
  const dropActive = phase === 'drop'
  const total = COMM221_PARSED.length

  return (
    <div className="mt-12 grid gap-4 lg:grid-cols-2">
      {/* The scanner — receives the dragged syllabus, then sweeps the raw page.
       * Both columns share one fixed height so they read as an even, balanced
       * pair (and so nothing reflows as the plan cascades in). */}
      <div
        ref={scannerRef}
        className="relative h-[384px] overflow-hidden rounded-2xl border border-border bg-surface p-4"
      >
        {showRaw ? (
          <RawPage scanning={scanning} parsed={parsed} total={total} />
        ) : (
          <>
            <div
              className={cn(
                'absolute inset-x-4 bottom-12 top-[104px] grid place-items-center rounded-xl border border-dashed transition-colors duration-200',
                dropActive ? 'border-accent bg-accent-soft' : 'border-border-strong',
              )}
            >
              <div className="flex flex-col items-center gap-1.5 text-subtle">
                <FileText size={20} className={cn(dropActive && 'text-accent')} aria-hidden />
                <span className="text-[11px]">
                  {dropActive ? 'Scanning syllabus…' : 'Drop your syllabus to scan'}
                </span>
              </div>
            </div>
            <p className="absolute inset-x-4 bottom-3.5 text-[11px] text-subtle">
              {dropActive ? 'Dropping into the scanner…' : 'Drag your syllabus into the scanner'}
            </p>
          </>
        )}
      </div>

      {/* The extracted plan — assessments cascade in one at a time */}
      <div className="flex h-[384px] flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface-2/50 px-5 py-3">
          <span className="text-[13px] font-semibold text-fg">Financial Markets</span>
          <span className="text-[12px] text-subtle">
            {parsed ? (phase === 'done' ? `${total} dates found` : `${revealed} of ${total}`) : 'Waiting…'}
          </span>
        </div>

        {!parsed ? (
          <div className="flex flex-1 items-center justify-center px-5 text-center text-[12px] text-subtle">
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
              <li className="animate-pulse px-5 py-2.5 text-[11px] text-subtle">Extracting…</li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}

/** The raw syllabus page sitting in the scanner — swept by the scan line. */
function RawPage({ scanning, parsed, total }: { scanning: boolean; parsed: boolean; total: number }) {
  return (
    <div className="ct-animate-fade">
      <div className="flex items-center gap-2 text-[12px] font-medium text-muted">
        <span className="rounded bg-danger/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-danger uppercase">
          PDF
        </span>
        syllabus.pdf
      </div>

      <div className="relative mt-3 overflow-hidden rounded-lg border border-border bg-canvas/50 p-3 font-mono text-[10px] leading-relaxed text-subtle">
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

        {scanning && (
          <div
            className="ct-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-accent/0 via-accent/25 to-accent/0"
            aria-hidden
          />
        )}
      </div>

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
        ) : null}
      </p>
    </div>
  )
}
