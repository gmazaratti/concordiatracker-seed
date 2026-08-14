import { useState } from 'react'
import type { Assessment } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { gradeNeeded, GRADE_TARGETS } from '@/lib/gpa'
import { useT } from '@/i18n/i18n'

/** FREE calculator — the honest, useful free tier: pick a target letter, see the
 * average you need on what's left. Real arithmetic via `gradeNeeded`. */
export function GradeNeeded({ assessments }: { assessments: Assessment[] }) {
  const t = useT()
  const [target, setTarget] = useState(80) // A- band by default
  const result = gradeNeeded(assessments, target)

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
          {t('courses.gradeNeeded')}
        </p>
        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-success uppercase">
          {t('courses.freeTag')}
        </span>
      </div>
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
          {t('courses.toFinishWith')}
          <Select
            ariaLabel={t('courses.targetGradeAria')}
            value={String(target)}
            onChange={(v) => setTarget(Number(v))}
            size="sm"
            tone="control"
            className="w-[120px]"
            options={GRADE_TARGETS.map((g) => ({
              value: String(g.min),
              label: `${g.letter} (${g.min}%+)`,
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
  const t = useT()
  if (result.kind === 'no-remaining')
    return <span className="text-muted">{t('courses.allGradedSet')}</span>
  if (result.kind === 'secured')
    return (
      <span className="text-success">
        {t('courses.alreadySecured')}
      </span>
    )
  if (result.kind === 'unreachable')
    return (
      <span className="text-danger">
        {t('courses.outOfReach')}
      </span>
    )
  return (
    <span className="text-fg">
      {t('courses.youNeed')}{' '}
      <span className="font-semibold text-accent">
        {Math.round(result.percent)}%
      </span>{' '}
      {t('courses.onAverageAcross')}{' '}
      <span className="font-semibold">{result.remainingWeight}%</span> {t('courses.ofTheGrade')}
    </span>
  )
}
