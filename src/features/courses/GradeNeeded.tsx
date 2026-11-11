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
    <Card className="overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <p className="font-display text-[15.5px] font-semibold text-fg">
          {t('courses.gradeNeeded')}
        </p>
        <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-success uppercase">
          {t('courses.freeTag')}
        </span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-2 text-[13.5px] text-muted">
          {t('courses.toFinishWith')}
          <Select
            ariaLabel={t('courses.targetGradeAria')}
            value={String(target)}
            onChange={(v) => setTarget(Number(v))}
            size="sm"
            tone="control"
            className="w-[132px]"
            options={GRADE_TARGETS.map((g) => ({
              value: String(g.min),
              label: `${g.letter} (${g.min}%+)`,
            }))}
          />
        </div>

        <div className="mt-4 rounded-2xl bg-canvas/60 px-4 py-3.5 text-[14.5px] leading-relaxed">
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
      <span className="font-display text-[20px] font-bold text-accent tabular-nums">
        {Math.round(result.percent)}%
      </span>{' '}
      {t('courses.onAverageAcross')}{' '}
      <span className="font-semibold">{result.remainingWeight}%</span> {t('courses.ofTheGrade')}
    </span>
  )
}
