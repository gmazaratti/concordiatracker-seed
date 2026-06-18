import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Upload } from 'lucide-react'
import type { Assessment } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { hist203Syllabus } from '@/data/mock'
import { courseStanding } from '@/lib/gpa'
import { PeerSuggestion } from '@/components/PeerSuggestion'
import { CourseHeader } from './CourseHeader'
import { CourseInfoPanel } from './CourseInfoPanel'
import { GradeBreakdown } from './GradeBreakdown'
import { AssessmentTable } from './AssessmentTable'
import { ManualAssessmentEditor } from './ManualAssessmentEditor'
import { CourseAnnouncements } from './CourseAnnouncements'
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
  const location = useLocation()
  const state = location.state as { focus?: string; importItems?: Assessment[] } | null
  const focusId = state?.focus
  const importItems = state?.importItems
  const { plan, courses, assessments, courseById, addAssessments, peerCorrections } = useAppData()
  const navigate = useNavigate()
  const course = courseId ? courseById(courseId) : undefined
  if (!course) return <Navigate to="/app/courses" replace />

  const courseAssessments = assessments.filter((a) => a.courseId === course.id)
  const courseAssessmentIds = new Set(courseAssessments.map((a) => a.id))
  const coursePeerCorrections = peerCorrections.filter((c) =>
    courseAssessmentIds.has(c.assessmentId),
  )
  const standing = courseStanding(courseAssessments)
  const empty = courseAssessments.length === 0
  const manual = course.origin === 'manual'

  // The parse-reveal plays for an in-flight blueprint import, or for the empty
  // HIST 203 sample. Manual courses are filled by hand, so they never parse.
  const revealItems = manual
    ? null
    : importItems
      ? importItems
      : empty && course.id === 'hist203'
        ? hist203Syllabus
        : null

  function completeImport(items: Assessment[]) {
    addAssessments(items)
    // Clear the import state so the reveal doesn't replay on the next render.
    if (importItems) {
      navigate(location.pathname, {
        replace: true,
        state: focusId ? { focus: focusId } : null,
      })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 py-5 sm:px-6">
      <CourseHeader course={course} currentPercent={standing.currentPercent} />

      <CourseAnnouncements courseId={course.id} />

      {revealItems ? (
        <SyllabusParseReveal
          course={course}
          items={revealItems}
          onComplete={completeImport}
          autoStart={!!importItems}
        />
      ) : manual ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
            <CourseInfoPanel
              course={course}
              totalAssessments={courseAssessments.length}
              editableIdentity
            />
            {!empty && <GradeBreakdown assessments={courseAssessments} color={course.color} />}
            {!empty && <GradeNeeded assessments={courseAssessments} />}
            {!empty && (
              <PaywallLock locked={plan === 'free'} feature="GPA prediction">
                <GpaWhatIf courses={courses} assessments={assessments} courseId={course.id} />
              </PaywallLock>
            )}
          </aside>

          <main className="min-w-0 flex-1">
            <ManualAssessmentEditor courseId={course.id} />
          </main>
        </div>
      ) : empty ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/50 px-6 py-12 text-center">
          <p className="text-[13px] text-subtle">No assessments yet for {course.code}.</p>
          <Link
            to={`/app/courses/blueprints?course=${course.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
          >
            <Upload size={15} aria-hidden />
            Import a syllabus
          </Link>
        </div>
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

          <main className="flex min-w-0 flex-1 flex-col gap-3">
            {coursePeerCorrections.length > 0 && (
              <div className="flex flex-col gap-2">
                {coursePeerCorrections.map((c) => (
                  <PeerSuggestion key={c.assessmentId} correction={c} />
                ))}
              </div>
            )}
            <AssessmentTable assessments={courseAssessments} focusId={focusId} />
          </main>
        </div>
      )}
    </div>
  )
}
