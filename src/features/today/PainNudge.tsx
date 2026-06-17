import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import { UpgradeChip } from '@/components/UpgradeChip'

/** Shown ONLY in the pain moment: lots due at once, on the free plan. It points
 * to the GPA predictor (a paid feature that lives in Courses) so the value prop
 * lands when it's actually felt, not as a persistent banner. On mobile it
 * collapses to a slim one-line chip so it stays visible without eating space. */
export function PainNudge({ count }: { count: number }) {
  return (
    <>
      <UpgradeChip
        icon={Sparkles}
        label="Predict your GPA"
        to="/app/courses"
        className="ct-animate-fade sm:hidden"
      />
      <Link
        to="/app/courses"
        className="ct-animate-fade group hidden items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 transition-colors duration-150 hover:border-accent/50 sm:flex"
      >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
        <Sparkles size={18} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-fg">
          {count} things due this week — see where to spend your energy
        </p>
        <p className="text-[12px] text-muted">
          The GPA predictor shows which deadlines move your grade most.
          <span className="ml-1 text-accent">Semester pass</span>
        </p>
      </div>
      <ArrowRight
        size={16}
        className="shrink-0 text-accent transition-transform duration-150 group-hover:translate-x-0.5"
        aria-hidden
      />
      </Link>
    </>
  )
}
