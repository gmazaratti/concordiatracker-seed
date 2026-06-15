import { FileText, Sparkles } from 'lucide-react'
import { hist203Syllabus } from '@/data/mock'
import { relativeDueLabel } from '@/lib/date'
import { KIND_LABEL } from '@/lib/assessment'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import type { Provenance } from '@/data/types'

const PROVENANCE_LEGEND: { provenance: Provenance; copy: string }[] = [
  { provenance: { status: 'official' }, copy: 'Pulled straight from the posted syllabus.' },
  { provenance: { status: 'confirmed', confirmations: 7 }, copy: 'Cross-checked by classmates who took it.' },
  { provenance: { status: 'unverified' }, copy: 'Entered once — flagged until corroborated.' },
]

/** The syllabus parse-reveal, told as a marketing beat: a scanned document on the
 * left becomes a structured, dated plan on the right. The scan line is the one
 * CSS keyframe shared with the real feature (`ct-scan-sweep`), kept subtle here. */
export function ParseShowcase() {
  return (
    <section id="how" className="scroll-mt-20 border-t border-border/60 px-5 py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[12px] font-medium text-muted">
            <Sparkles size={13} className="text-accent" />
            The hero move
          </span>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.05] font-medium text-fg">
            Drop your syllabus.
            <br />
            Watch it become a plan.
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
            Upload the PDF and every deadline, weight, and exam lifts off the page
            into your term — dated, weighted, and ready to track. No copying into a
            calendar by hand.
          </p>
        </div>

        <div className="mt-12 grid items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* The document being scanned */}
          <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-6">
            <div className="mb-4 flex items-center gap-2 text-[12px] text-subtle">
              <FileText size={14} />
              HIST 203 — syllabus.pdf
            </div>
            <div className="space-y-2.5">
              {DOC_LINES.map((w, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded-full bg-border/70"
                  style={{ width: w }}
                />
              ))}
            </div>
            <div className="ct-scan-sweep pointer-events-none absolute inset-x-4 top-0 h-16 rounded-full bg-gradient-to-b from-accent/0 via-accent/20 to-accent/0" />
          </div>

          {/* The extracted plan */}
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border bg-surface-2/50 px-5 py-3">
              <span className="text-[13px] font-semibold text-fg">Canada Since Confederation</span>
              <span className="text-[12px] text-subtle">{hist203Syllabus.length} dates found</span>
            </div>
            <ul className="divide-y divide-border">
              {hist203Syllabus.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-fg">{a.title}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-subtle">
                      <span>
                        {KIND_LABEL[a.kind]} · {a.weight}%
                      </span>
                      <ProvenanceBadge provenance={a.provenance} tone="quiet" />
                    </div>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold text-fg">
                    {relativeDueLabel(a.due)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
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

const DOC_LINES = ['85%', '70%', '92%', '55%', '78%', '64%', '88%', '48%']
