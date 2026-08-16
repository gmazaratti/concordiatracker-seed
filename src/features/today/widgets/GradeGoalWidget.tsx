import { Target } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { Select } from '@/components/ui/Select'
import { gradeNeeded, GRADE_TARGETS } from '@/lib/gpa'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * "What do I need on what's left" for one pinned course, on Today.
 *
 * The same free calculator that lives on the course page, surfaced where you
 * actually ask the question. Deliberately the FREE one — the paid projection
 * stays in Courses, so the widget is useful rather than a teaser.
 */
export function GradeGoalWidget() {
  const { courses, assessments } = useAppData()
  const { uiState, patchUiState } = useUiState()

  const course = courses.find((c) => c.id === uiState.gradeGoalCourse) ?? courses[0]
  const target = uiState.gradeGoalTarget ?? 80

  if (!course) {
    return (
      <WidgetCard title="Grade goal" icon={Target}>
        <WidgetEmpty>Add a course to set a goal.</WidgetEmpty>
      </WidgetCard>
    )
  }

  const mine = assessments.filter((a) => a.courseId === course.id)
  const result = gradeNeeded(mine, target)

  return (
    <WidgetCard
      title="Grade goal"
      icon={Target}
      action={
        courses.length > 1 ? (
          <Select
            ariaLabel="Course"
            value={course.id}
            onChange={(id) => patchUiState({ gradeGoalCourse: id })}
            size="sm"
            tone="control"
            className="w-[104px]"
            options={courses.map((c) => ({ value: c.id, label: c.code || 'Course' }))}
          />
        ) : undefined
      }
    >
      <div className="px-3.5 py-3">
        <div className="flex items-center justify-between gap-2 text-[12px] text-subtle">
          To finish with
          <Select
            ariaLabel="Target grade"
            value={String(target)}
            onChange={(v) => patchUiState({ gradeGoalTarget: Number(v) })}
            size="sm"
            tone="control"
            className="w-[104px]"
            options={GRADE_TARGETS.map((g) => ({
              value: String(g.min),
              label: `${g.letter} (${g.min}%+)`,
            }))}
          />
        </div>
        <p className="mt-2.5 text-[13px]">
          {result.kind === 'no-remaining' ? (
            <span className="text-muted">Everything&rsquo;s graded: the final is set.</span>
          ) : result.kind === 'secured' ? (
            <span className="text-success">Already secured.</span>
          ) : result.kind === 'unreachable' ? (
            <span className="text-danger">Out of reach: even a perfect score finishes below.</span>
          ) : (
            <span className="text-fg">
              You need{' '}
              <span className="font-semibold text-accent">{Math.round(result.percent)}%</span> on the
              remaining <span className="font-semibold">{result.remainingWeight}%</span>.
            </span>
          )}
        </p>
      </div>
    </WidgetCard>
  )
}
