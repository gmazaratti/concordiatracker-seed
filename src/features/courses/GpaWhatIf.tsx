import { useState } from 'react'
import type { Assessment, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { useT } from '@/i18n/i18n'
import {
  courseStanding,
  currentGpa,
  percentToGrade,
  projectedCoursePercent,
  projectedGpa,
} from '@/lib/gpa'

/** PAID what-if: drag the average you expect on everything still ungraded and
 * watch the course grade — and your whole-term GPA — move in real time. Real
 * arithmetic via `projectedCoursePercent` / `projectedGpa`. The page wraps this
 * in `PaywallLock` for free users, so the value shows blurred behind the gate. */
export function GpaWhatIf({
  courses,
  assessments,
  courseId,
}: {
  courses: Course[]
  assessments: Assessment[]
  courseId: string
}) {
  const t = useT()
  const courseAssessments = assessments.filter((a) => a.courseId === courseId)
  const standing = courseStanding(courseAssessments)
  const [assumed, setAssumed] = useState(() =>
    Math.round(standing.currentPercent ?? 80),
  )

  const allGraded = standing.remainingWeight <= 0
  const projectedPct = projectedCoursePercent(courseAssessments, assumed)
  const projGrade = projectedPct === null ? null : percentToGrade(projectedPct)
  const nowGpa = currentGpa(courses, assessments)
  const projGpa =
    projectedPct === null
      ? nowGpa
      : projectedGpa(courses, assessments, courseId, projectedPct)
  const delta = projGpa !== null && nowGpa !== null ? projGpa - nowGpa : null

  return (
    <Card className="overflow-hidden rounded-3xl">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <p className="font-display text-[15.5px] font-semibold text-fg">
          {t('courses.gpaWhatIf')}
        </p>
        <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-accent uppercase">
          {t('courses.semesterTag')}
        </span>
      </div>

      <div className="px-5 py-4">
        {allGraded ? (
          <p className="text-[14px] leading-relaxed text-muted">
            {t('courses.everythingGradedA')}{' '}
            <span className="font-semibold text-fg">
              {Math.round(standing.currentPercent ?? 0)}%
            </span>
            .
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor={`whatif-${courseId}`}
                className="text-[13.5px] text-muted"
              >
                {t('courses.assumeRemaining')}
              </label>
              <span className="font-display text-[20px] font-bold text-accent tabular-nums">
                {assumed}%
              </span>
            </div>
            <input
              id={`whatif-${courseId}`}
              type="range"
              min={0}
              max={100}
              value={assumed}
              onChange={(e) => setAssumed(Number(e.target.value))}
              // The themed slider (.ct-range): the native one drew a white
              // track. Filled in the accent up to the value, the rest in the
              // theme's border colour, so it matches every theme.
              className="ct-range ct-range-lg mt-3 w-full"
              style={{
                background: `linear-gradient(to right, var(--ct-accent) 0%, var(--ct-accent) ${assumed}%, var(--ct-border-strong) ${assumed}%, var(--ct-border-strong) 100%)`,
              }}
            />

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Stat label={t('courses.finishesAt')}>
                <span className="text-fg">{Math.round(projectedPct ?? 0)}%</span>
                {projGrade && (
                  <span className="text-muted"> · {projGrade.letter}</span>
                )}
              </Stat>
              <Stat label={t('courses.termGpa')}>
                <span className="text-fg">{projGpa?.toFixed(2) ?? '—'}</span>
                {delta !== null && Math.abs(delta) >= 0.005 && (
                  <span
                    className={delta > 0 ? 'text-success' : 'text-danger'}
                  >
                    {' '}
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(2)}
                  </span>
                )}
              </Stat>
            </div>
            {nowGpa !== null && (
              <p className="mt-3 text-[12px] leading-relaxed text-subtle">
                {t('courses.currentTermGpa', {
                  gpa: nowGpa.toFixed(2),
                  weight: standing.remainingWeight,
                })}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

function Stat({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-canvas/60 px-3.5 py-3">
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-0.5 font-display text-[20px] leading-tight font-bold tabular-nums">{children}</div>
    </div>
  )
}
