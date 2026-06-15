import { Card } from '@/components/ui/Card'
import type { CourseStanding as Standing } from '@/lib/gpa'

/** Rail panel: how much of the grade is decided vs. still in play — the context
 * the two calculators below it operate on. */
export function CourseStandingPanel({ standing }: { standing: Standing }) {
  const gradedPct =
    standing.totalWeight === 0
      ? 0
      : (standing.gradedWeight / standing.totalWeight) * 100

  return (
    <Card className="overflow-hidden">
      <p className="border-b border-border px-3.5 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Course standing
      </p>
      <div className="px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] text-subtle">Graded so far</span>
          <span className="text-[12px] font-medium text-fg">
            {Math.round(gradedPct)}% of the grade
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-200"
            style={{ width: `${gradedPct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-lg bg-surface-2 px-2 py-2">
            <div className="text-[15px] font-semibold text-fg">
              {standing.gradedWeight}%
            </div>
            <div className="text-[11px] text-subtle">locked in</div>
          </div>
          <div className="rounded-lg bg-surface-2 px-2 py-2">
            <div className="text-[15px] font-semibold text-fg">
              {standing.remainingWeight}%
            </div>
            <div className="text-[11px] text-subtle">still to play for</div>
          </div>
        </div>
      </div>
    </Card>
  )
}
