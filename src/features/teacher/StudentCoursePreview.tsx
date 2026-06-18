import { ArrowLeft, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { courseStanding } from '@/lib/gpa'
import { KIND_LABEL } from '@/lib/assessment'
import { formatDueDateTime } from '@/lib/date'
import {
  outlineItemToAssessment,
  teacherCourseToCourse,
  type TeacherCourse,
} from '@/data/teacher'
import type { Assessment } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { CourseHeader } from '@/features/courses/CourseHeader'
import { CourseInfoPanel } from '@/features/courses/CourseInfoPanel'
import { GradeBreakdown } from '@/features/courses/GradeBreakdown'

/** A full embed of the student's course-detail view, built from the REAL student
 * components (header, the class-details panel, grade breakdown, the assessment
 * list) fed with the teacher's outline. The class-details panel is editable, so
 * the teacher sets the instructor/TA/office hours/etc. students see right here. */
export function StudentCoursePreview({
  course,
  onClose,
}: {
  course: TeacherCourse
  onClose: () => void
}) {
  const { courseById } = useAppData()
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)

  const previewCourse = courseById(course.courseId) ?? teacherCourseToCourse(course)
  const assessments = course.outline.map((o) => outlineItemToAssessment(o, course.courseId))
  const standing = courseStanding(assessments)

  return (
    <div className="ct-animate-fade fixed inset-0 z-50 bg-canvas" onKeyDown={onKeyDown}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Student preview"
        tabIndex={-1}
        className="h-full overflow-y-auto outline-none"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-canvas/85 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft size={16} aria-hidden />
            Back to workspace
          </button>
          <span className="hidden text-[12px] text-subtle sm:block">
            Student preview — class details are editable; grades are each student's own.
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
          <CourseHeader course={previewCourse} currentPercent={standing.currentPercent} />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <aside className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
              <CourseInfoPanel course={previewCourse} totalAssessments={assessments.length} />
              <GradeBreakdown assessments={assessments} color={previewCourse.color} />
            </aside>
            <main className="min-w-0 flex-1">
              <ReadOnlyAssessments assessments={assessments} />
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReadOnlyAssessments({ assessments }: { assessments: Assessment[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        Assessments — what students import
      </div>
      {assessments.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-subtle">No assessments yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {assessments.map((a) => (
            <li key={a.id} className="flex items-center gap-2.5 px-4 py-3">
              <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                {KIND_LABEL[a.kind]}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                {a.title || 'Untitled'}
              </span>
              <span className="hidden shrink-0 text-[11px] text-subtle sm:block">
                {formatDueDateTime(a.due)}
              </span>
              <span className="shrink-0 text-[11px] font-medium text-muted tabular-nums">
                {a.weight}%
              </span>
              <ProvenanceBadge provenance={a.provenance} className="shrink-0" />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
