import { useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { Loader2, Upload } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { ModalShell } from '@/command/ModalShell'
import { PeerSuggestion } from '@/components/PeerSuggestion'
import { MoodleCourseSection } from '@/features/moodle/MoodleCourseSection'
import { CourseNotesCard } from '@/features/notes/CourseNotesCard'
import { findMoodleMismatches } from '@/lib/moodle-match'
import { cn } from '@/lib/cn'
import { AssessmentTable } from '../AssessmentTable'
import { CourseAnnouncements } from '../CourseAnnouncements'
import { ManualCourseAssessments } from '../CourseDetailPage'
import { CourseInfoPanel } from '../CourseInfoPanel'
import { GpaWhatIf } from '../GpaWhatIf'
import { GradeBreakdown } from '../GradeBreakdown'
import { GradeNeeded } from '../GradeNeeded'
import { MoodleMismatchCard } from '../MoodleMismatch'
import { PaywallLock } from '../Paywall'
import { SectionDeadlinesCard } from '../SectionDeadlinesCard'
import { SyllabusFileCard } from '../SyllabusFileCard'
import { SyllabusUploadPage } from '../SyllabusUpload'
import { TeacherChangeCard } from '../TeacherChangeCard'
import { DetailHero } from './DetailHero'

type Pane = 'work' | 'grade' | 'class'
const PANES: { id: Pane; label: string }[] = [
  { id: 'work', label: 'Assessments' },
  { id: 'grade', label: 'Your grade' },
  { id: 'class', label: 'Class details' },
]

/**
 * PREVIEW ONLY, at /app/courses/preview/:courseId. Reached from the cards on
 * /app/courses/preview and nowhere else.
 *
 * A proposed class page: the same tools as the live one (the assessment list,
 * the grade breakdown, grade needed, the what-if, the class details), arranged
 * as a banner (whose last cell is what is due next) and three titled parts. On a wide screen the
 * class details and the grade are a pinned rail on the left of the assessments; on a phone the
 * three parts are tabs, so the list is not buried under the details.
 */
export function CourseDetailPreviewPage() {
  const { courseId } = useParams()
  const location = useLocation()
  const { plan, courses, assessments, dataLoading, courseById, peerCorrections, personalTasks } = useAppData()
  const { openAssessment } = useQuickActions()
  const [importing, setImporting] = useState(false)
  const [pane, setPane] = useState<Pane>('work')
  const focusId = (location.state as { focus?: string } | null)?.focus

  if (dataLoading) {
    return (
      <div className="grid h-svh place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  const course = courseId ? courseById(courseId) : undefined
  if (!course) return <Navigate to="/app/courses/preview" replace />

  const mine = assessments.filter((a) => a.courseId === course.id)
  const ids = new Set(mine.map((a) => a.id))
  const empty = mine.length === 0
  const corrections = peerCorrections.filter((c) => ids.has(c.assessmentId))
  const mismatches = findMoodleMismatches(personalTasks, assessments, courses).filter((m) => ids.has(m.assessmentId))

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-5 py-5 sm:px-6">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-border-strong px-4 py-2.5 text-[13px] text-muted">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-accent-contrast uppercase">Preview</span>
        A proposed class page. Everything on it works on your real class.
        <Link to={`/app/courses/${course.id}`} className="ml-auto font-medium text-accent hover:underline">
          Open the live page
        </Link>
      </p>

      <DetailHero course={course} assessments={mine} backTo="/app/courses/preview" onImport={() => setImporting(true)} onOpen={openAssessment} />
      <CourseAnnouncements courseCode={course.code} />

      {/* Phones: one part at a time. From lg up all three are on screen. */}
      <div role="tablist" aria-label="Parts of this class" className="flex gap-2 overflow-x-auto lg:hidden">
        {PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={pane === p.id}
            onClick={() => setPane(p.id)}
            className={cn(
              'rounded-full px-4 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors duration-150',
              pane === p.id ? 'bg-fg text-canvas' : 'border border-border text-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-x-5 gap-y-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <main className={cn('min-w-0 space-y-3 lg:order-2', pane !== 'work' && 'hidden lg:block')}>
          <h2 className="hidden font-display text-[22px] font-semibold tracking-tight text-fg lg:block">Assessments</h2>
          <TeacherChangeCard items={mine.filter((a) => a.teacherPrev)} />
          {mismatches.map((m) => (
            <MoodleMismatchCard key={m.assessmentId} mismatch={m} />
          ))}
          {corrections.map((c) => (
            <PeerSuggestion key={c.assessmentId} correction={c} />
          ))}
          {empty && (
            <div className="rounded-3xl border border-accent/40 bg-accent-soft/60 p-5 sm:p-6">
              <p className="font-display text-[18px] font-semibold text-fg">Got the outline for {course.code || 'this class'}?</p>
              <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted">
                Upload it and we read the assessments, dates and weights into this class. You review everything before
                it is added.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setImporting(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                >
                  <Upload size={15} aria-hidden /> Upload the outline
                </button>
                <Link to={`/app/courses/blueprints?course=${course.id}`} className="text-[13px] font-medium text-muted hover:text-fg">
                  or find a classmate&rsquo;s blueprint
                </Link>
              </div>
            </div>
          )}
          {course.origin === 'manual' ? (
            <ManualCourseAssessments courseId={course.id} assessments={mine} focusId={focusId} />
          ) : (
            !empty && <AssessmentTable assessments={mine} focusId={focusId} />
          )}
          <MoodleCourseSection course={course} />
        </main>

        {/* The side rail, on the left as on the live page: everything about the
            class and the grade in one place. It stays put while the assessment
            list scrolls, with its own scroll when it is taller than the screen. */}
        <aside className="ct-scroll-fade min-w-0 space-y-8 lg:sticky lg:top-4 lg:order-1 lg:max-h-[calc(100svh-2rem)] lg:overflow-y-auto lg:pr-1.5">
          <section className={cn('space-y-3', pane !== 'class' && 'hidden lg:block')}>
            <h2 className="hidden font-display text-[22px] font-semibold tracking-tight text-fg lg:block">Class details</h2>
            <CourseInfoPanel course={course} totalAssessments={mine.length} editableIdentity={course.origin === 'manual'} />
            <SectionDeadlinesCard course={course} />
            <SyllabusFileCard course={course} />
            <CourseNotesCard course={course} />
          </section>
          <section className={cn('space-y-3', pane !== 'grade' && 'hidden lg:block')}>
            <h2 className="hidden font-display text-[22px] font-semibold tracking-tight text-fg lg:block">Your grade</h2>
            {empty ? (
              <p className="rounded-3xl border border-dashed border-border-strong px-5 py-6 text-[14px] leading-relaxed text-muted">
                Your breakdown, the grade you need and the what-if appear once this class has assessments.
              </p>
            ) : (
              <>
                <GradeBreakdown assessments={mine} color={course.color} />
                <GradeNeeded assessments={mine} />
                <PaywallLock locked={plan === 'free'} feature="GPA prediction">
                  <GpaWhatIf courses={courses} assessments={assessments} courseId={course.id} />
                </PaywallLock>
              </>
            )}
          </section>
        </aside>
      </div>

      {importing && (
        <ModalShell label={`Import an outline into ${course.code}`} onClose={() => setImporting(false)} widthClass="sm:max-w-2xl">
          <SyllabusUploadPage intoCourseId={course.id} onDone={() => setImporting(false)} />
        </ModalShell>
      )}
    </div>
  )
}
