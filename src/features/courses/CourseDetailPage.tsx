import { Navigate, useParams } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { hist203Syllabus } from '@/data/mock'
import { courseStanding } from '@/lib/gpa'
import { CourseHeader } from './CourseHeader'
import { CourseInfoPanel } from './CourseInfoPanel'
import { GradeBreakdown } from './GradeBreakdown'
import { AssessmentTable } from './AssessmentTable'
import { GradeNeeded } from './GradeNeeded'
import { GpaWhatIf } from './GpaWhatIf'
import { PaywallLock } from './Paywall'
import { SyllabusParseReveal } from './SyllabusParseReveal'

/** Course detail — the grade workspace. An empty course leads with the syllabus
 * parse-reveal (the hero); a populated one is a two-column editor: a LEFT panel
 * (class details + grade breakdown + grade-needed FREE + GPA what-if PAID) beside
 * the assignment list, stacked on mobile in Today's layout language. */
export function CourseDetailPage() {
  const { courseId } = useParams()
  const { plan, courses, assessments, courseById, addAssessments } = useAppData()
  const course = courseId ? courseById(courseId) : undefined
  if (!course) return <Navigate to="/app/courses" replace />

  const courseAssessments = assessments.filter((a) => a.courseId === course.id)
  const standing = courseStanding(courseAssessments)
  const empty = courseAssessments.length === 0

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <CourseHeader course={course} currentPercent={standing.currentPercent} />

      {empty ? (
        course.id === 'hist203' ? (
          <SyllabusParseReveal
            course={course}
            items={hist203Syllabus}
            onComplete={addAssessments}
          />
        ) : (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[13px] text-subtle">
            No assessments yet — import a syllabus to add dates.
          </p>
        )
      ) : (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
            <CourseInfoPanel
              course={course}
              totalAssessments={courseAssessments.length}
            />
            <GradeBreakdown assessments={courseAssessments} color={course.color} />
            <GradeNeeded assessments={courseAssessments} />
            <PaywallLock locked={plan === 'free'} feature="GPA prediction">
              <GpaWhatIf
                courses={courses}
                assessments={assessments}
                courseId={course.id}
              />
            </PaywallLock>
          </aside>

          <main className="min-w-0 flex-1">
            <AssessmentTable assessments={courseAssessments} />
          </main>
        </div>
      )}
    </div>
  )
}
