import { useState } from 'react'
import type { Assessment, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
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
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
        <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
          GPA what-if
        </p>
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
          Semester
        </span>
      </div>

      <div className="px-3.5 py-3">
        {allGraded ? (
          <p className="text-[13px] text-muted">
            Every assessment is graded — there's nothing left to project. This
            course is locked at{' '}
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
                className="text-[12px] text-subtle"
              >
                Assume on remaining work
              </label>
              <span className="text-[15px] font-semibold text-accent tabular-nums">
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
              className="mt-2 w-full accent-[var(--ct-accent)]"
            />

            <div className="mt-3 grid grid-cols-2 gap-2">
              <Stat label="Course finishes at">
                <span className="text-fg">{Math.round(projectedPct ?? 0)}%</span>
                {projGrade && (
                  <span className="text-muted"> · {projGrade.letter}</span>
                )}
              </Stat>
              <Stat label="Term GPA">
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
              <p className="mt-2 text-[11px] text-subtle">
                Current term GPA {nowGpa.toFixed(2)} · this course is{' '}
                {standing.remainingWeight}% still in play.
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
    <div className="rounded-lg bg-surface-2 px-2.5 py-2">
      <div className="text-[11px] text-subtle">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums">{children}</div>
    </div>
  )
}
