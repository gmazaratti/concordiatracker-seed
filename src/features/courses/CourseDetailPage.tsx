import { Navigate, useParams } from 'react-router-dom'
import { useAppData } from '@/app/providers/app-data'
import { hist203Syllabus } from '@/data/mock'
import { courseStanding } from '@/lib/gpa'
import { CourseHeader } from './CourseHeader'
import { CourseStandingPanel } from './CourseStanding'
import { AssessmentTable } from './AssessmentTable'
import { GradeNeeded } from './GradeNeeded'
import { GpaWhatIf } from './GpaWhatIf'
import { PaywallLock } from './Paywall'
import { SyllabusParseReveal } from './SyllabusParseReveal'

/** Course detail — the grade workspace. An empty course leads with the syllabus
 * parse-reveal (the hero); a populated one is the two-column editor + calculator
 * rail (standing, grade-needed FREE, GPA what-if PAID), in Today's layout language. */
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
          <main className="order-2 min-w-0 flex-1 lg:order-1">
            <AssessmentTable assessments={courseAssessments} />
          </main>

          <aside className="order-1 flex flex-col gap-3 lg:order-2 lg:w-[280px] lg:shrink-0">
            <CourseStandingPanel standing={standing} />
            <GradeNeeded assessments={courseAssessments} />
            <PaywallLock locked={plan === 'free'} feature="GPA prediction">
              <GpaWhatIf
                courses={courses}
                assessments={assessments}
                courseId={course.id}
              />
            </PaywallLock>
          </aside>
        </div>
      )}
    </div>
  )
}
