import { useState } from 'react'
import { ChevronDown, Info } from 'lucide-react'
import type { Assessment, AssessmentKind } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { KIND_LABEL } from '@/lib/assessment'
import { gradeToPercent } from '@/lib/grade'
import { courseStanding, gradeTerms, weightedAverage } from '@/lib/gpa'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'

interface CategoryRow {
  kind: AssessmentKind
  weight: number
  gradedWeight: number
  /** Weighted average % over the category's graded work, or null. */
  average: number | null
}

function breakdown(assessments: Assessment[]): CategoryRow[] {
  const map = new Map<AssessmentKind, { weight: number; gw: number; pts: number }>()
  for (const a of assessments) {
    const acc = map.get(a.kind) ?? { weight: 0, gw: 0, pts: 0 }
    acc.weight += a.weight
    const pct = gradeToPercent(a.grade)
    if (pct !== null) {
      acc.gw += a.weight
      acc.pts += (pct * a.weight) / 100
    }
    map.set(a.kind, acc)
  }
  return [...map.entries()]
    .map(([kind, v]) => ({
      kind,
      weight: v.weight,
      gradedWeight: v.gw,
      average: v.gw === 0 ? null : (v.pts / v.gw) * 100,
    }))
    .sort((a, b) => b.weight - a.weight)
}

/** Course-detail LEFT panel: the grade's composition — every category by weight
 * (with its graded average so far), over a graded-vs-remaining summary. Replaces
 * the bare standing card; accent-tinted to the class color. */
export function GradeBreakdown({
  assessments,
  color,
}: {
  assessments: Assessment[]
  color: string
}) {
  const rows = breakdown(assessments)
  const standing = courseStanding(assessments)
  const { hex } = courseColor(color)
  const gradedPct =
    standing.totalWeight === 0
      ? 0
      : (standing.gradedWeight / standing.totalWeight) * 100

  return (
    <Card className="overflow-hidden rounded-3xl">
      <p className="border-b border-border px-5 py-3.5 font-display text-[15.5px] font-semibold text-fg">
        Grade breakdown
      </p>

      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13.5px] text-muted">Graded so far</span>
          <span className="text-[13.5px] font-semibold text-fg">
            {Math.round(gradedPct)}% of the grade
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full transition-[width] duration-200"
            style={{ width: `${gradedPct}%`, backgroundColor: hex }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-canvas/60 px-3.5 py-3">
            <div className="font-display text-[22px] leading-tight font-bold text-fg tabular-nums">
              {standing.gradedWeight}%
            </div>
            <div className="text-[12px] text-muted">locked in</div>
          </div>
          <div className="rounded-2xl bg-canvas/60 px-3.5 py-3">
            <div className="font-display text-[22px] leading-tight font-bold text-fg tabular-nums">
              {standing.remainingWeight}%
            </div>
            <div className="text-[12px] text-muted">still to play for</div>
          </div>
        </div>
      </div>

      <ul className="border-t border-border">
        {rows.map((r) => (
          <li
            key={r.kind}
            className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3 last:border-b-0"
          >
            <span className="flex items-center gap-2.5 text-[14px] font-medium text-fg">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: hex }}
                aria-hidden
              />
              {KIND_LABEL[r.kind]}
            </span>
            <span className="flex items-center gap-2.5 text-[13.5px] tabular-nums">
              {r.average !== null && (
                <span className="font-medium text-muted">
                  {Math.round(r.average)}%
                </span>
              )}
              <span className="w-9 text-right font-semibold text-fg">
                {r.weight}%
              </span>
            </span>
          </li>
        ))}
      </ul>

      <HowCalculated assessments={assessments} />
    </Card>
  )
}

const round1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Collapsed-by-default disclosure: the exact weighted-average behind the course
 * grade — general form + the student's real plugged-in numbers. Reads from the
 * shared `gradeTerms` / `weightedAverage`, so it mirrors the computed grade. */
function HowCalculated({ assessments }: { assessments: Assessment[] }) {
  const [open, setOpen] = useState(false)
  const terms = gradeTerms(assessments)
  const result = weightedAverage(terms)
  const totalWeight = terms.reduce((sum, t) => sum + t.weight, 0)

  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-5 py-3.5 text-[13px] text-muted transition-colors hover:text-fg"
      >
        <Info size={13} aria-hidden />
        How is this calculated?
        <ChevronDown
          size={14}
          className={cn('ml-auto transition-transform duration-150', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {open && (
        <div className="space-y-3 px-5 pb-4 text-[13px] leading-relaxed text-muted">
          <p>
            Your grade is a <span className="font-medium text-fg">weighted average</span>:
            each category counts in proportion to its weight, divided by the weight
            graded so far.
          </p>

          <div className="rounded-2xl bg-canvas/60 px-4 py-3">
            <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
              The method
            </p>
            <p className="mt-1 text-fg">
              grade = ( weight × score + … ) ÷ ( sum of weights )
            </p>
          </div>

          {result === null ? (
            <p className="text-subtle">
              Nothing is graded yet: enter a grade and the worked-out math appears here.
            </p>
          ) : (
            <div className="rounded-2xl bg-canvas/60 px-4 py-3">
              <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                Your numbers
              </p>
              <p className="mt-1.5 text-fg">
                ={' '}
                {terms.map((t, i) => (
                  <span key={t.kind}>
                    {i > 0 && <span className="text-subtle"> + </span>}
                    <span className="text-subtle">(</span>
                    {KIND_LABEL[t.kind]} <span className="font-medium">{t.weight}</span>
                    <span className="text-subtle"> × </span>
                    <span className="font-medium">{round1(t.percent)}</span>
                    <span className="text-subtle">)</span>
                  </span>
                ))}{' '}
                <span className="text-subtle">÷ {totalWeight}</span>
              </p>
              <p className="mt-1.5 text-[13px] font-semibold text-fg">
                = {round1(result)}%
                <span className="ml-1.5 text-[11px] font-normal text-subtle">
                  your current grade (rounds to {Math.round(result)}%)
                </span>
              </p>
              <p className="mt-2 text-[11px] text-subtle">
                <span className="font-medium">weight</span> = the category’s share of the
                grade · <span className="font-medium">score</span> = your average in that
                category
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
