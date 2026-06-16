import { useState } from 'react'
import type { Assessment } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { gradeNeeded, GRADE_TARGETS } from '@/lib/gpa'

/** FREE calculator — the honest, useful free tier: pick a target letter, see the
 * average you need on what's left. Real arithmetic via `gradeNeeded`. */
export function GradeNeeded({ assessments }: { assessments: Assessment[] }) {
  const [target, setTarget] = useState(80) // A- band by default
  const result = gradeNeeded(assessments, target)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
          Grade needed
        </p>
        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-success uppercase">
          Free
        </span>
      </div>
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
          To finish with
          <Select
            ariaLabel="Target grade"
            value={String(target)}
            onChange={(v) => setTarget(Number(v))}
            size="sm"
            tone="control"
            className="w-[120px]"
            options={GRADE_TARGETS.map((t) => ({
              value: String(t.min),
              label: `${t.letter} (${t.min}%+)`,
            }))}
          />
        </div>

        <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
          <ResultLine result={result} />
        </div>
      </div>
    </Card>
  )
}

function ResultLine({ result }: { result: ReturnType<typeof gradeNeeded> }) {
  if (result.kind === 'no-remaining')
    return <span className="text-muted">Everything's graded — the final is set.</span>
  if (result.kind === 'secured')
    return (
      <span className="text-success">
        Already secured — even 0% on what's left holds this.
      </span>
    )
  if (result.kind === 'unreachable')
    return (
      <span className="text-danger">
        Out of reach — even a perfect 100% finishes below this target.
      </span>
    )
  return (
    <span className="text-fg">
      You need{' '}
      <span className="font-semibold text-accent">
        {Math.round(result.percent)}%
      </span>{' '}
      on average across the remaining{' '}
      <span className="font-semibold">{result.remainingWeight}%</span> of the grade.
    </span>
  )
}
