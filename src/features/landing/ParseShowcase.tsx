import { Sparkles } from 'lucide-react'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import type { Provenance } from '@/data/types'
import { ParseRevealDemo } from './ParseRevealDemo'

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

        <ParseRevealDemo />

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
