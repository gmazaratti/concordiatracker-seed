import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, ChevronDown, Loader2, Pencil, Upload } from 'lucide-react'
import type { Assessment } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { courseStanding } from '@/lib/gpa'
import { cn } from '@/lib/cn'
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
import { currentTermName, isUpcomingTerm } from '@/features/planner/past-terms'

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
  const { plan, courses, assessments, dataLoading, courseById, addAssessments, peerCorrections } =
    useAppData()
  const navigate = useNavigate()
  const course = courseId ? courseById(courseId) : undefined
  /** Opt-in for the rare student who has next term's syllabus already. Hoisted
   *  above the early returns below, because hooks cannot follow them. */
  const [outlineEarly, setOutlineEarly] = useState(false)

  // On a hard refresh the data is still loading — wait for it before deciding the
  // course doesn't exist, otherwise we'd redirect away from a perfectly valid course.
  if (dataLoading) {
    return (
      <div className="grid h-svh place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (!course) return <Navigate to="/app/courses" replace />

  const courseAssessments = assessments.filter((a) => a.courseId === course.id)
  const courseAssessmentIds = new Set(courseAssessments.map((a) => a.id))
  const coursePeerCorrections = peerCorrections.filter((c) =>
    courseAssessmentIds.has(c.assessmentId),
  )
  const standing = courseStanding(courseAssessments)
  const empty = courseAssessments.length === 0
  const manual = course.origin === 'manual'
  const courseId2 = course.id

  /**
   * A term that has not started yet.
   *
   * These courses get the class details and nothing else. Outlines are published
   * in the first week, so there is nothing real to enter — and a blueprint from
   * a previous term would hand you dates that are confidently wrong, which is
   * worse than an empty page because you would plan around them. The rare
   * student who genuinely has the syllabus early can say so; everyone else is
   * not shown a form they cannot fill.
   */
  const upcoming = !!course.term && isUpcomingTerm(course.term) && course.term !== currentTermName()
  const holding = upcoming && empty && !outlineEarly && !importItems

  // The parse-reveal plays whenever there are in-flight import items (a blueprint
  // import or the "Upload a syllabus" sample) — even onto a manual course.
  const revealItems = importItems ?? null

  function completeImport(items: Assessment[]) {
    // Stamp THIS course's id on every item — the blueprint/sample items carry the
    // source's id (or a code), so without this they'd attach to the wrong course.
    addAssessments(items.map((i) => ({ ...i, courseId: courseId2 })))
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

      <CourseAnnouncements courseCode={course.code} />

      {holding ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <aside className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
            <CourseInfoPanel
              course={course}
              totalAssessments={0}
              editableIdentity={manual}
            />
          </aside>

          <main className="min-w-0 flex-1">
            <div className="rounded-xl border border-dashed border-border-strong bg-surface/50 px-6 py-12 text-center">
              <CalendarClock size={22} className="mx-auto text-subtle" aria-hidden />
              <p className="mt-3 text-[15px] font-medium text-fg">Waiting for {course.term}</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-subtle">
                This class is saved and out of the way until the term begins. Assignments and dates
                come from the outline, which your professor publishes in the first week — nothing
                worth entering exists yet.
              </p>
              <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-subtle">
                You can still fill in the class details on the left whenever you like.
              </p>
              {/* Deliberately quiet. It is the right door for a handful of
                  people and a wrong turn for everyone else. */}
              <button
                type="button"
                onClick={() => setOutlineEarly(true)}
                className="mt-4 text-[12px] text-subtle underline underline-offset-2 transition-colors duration-150 hover:text-fg"
              >
                I already have the outline
              </button>
            </div>
          </main>
        </div>
      ) : revealItems ? (
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
            <ManualCourseAssessments
              courseId={course.id}
              assessments={courseAssessments}
              focusId={focusId}
            />
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
            <div data-tour="course-info">
              <CourseInfoPanel
                course={course}
                totalAssessments={courseAssessments.length}
              />
            </div>
            <div data-tour="breakdown">
              <GradeBreakdown assessments={courseAssessments} color={course.color} />
            </div>
            <div data-tour="grade-needed">
              <GradeNeeded assessments={courseAssessments} />
            </div>
            <div data-tour="gpa-predict">
              <PaywallLock locked={plan === 'free'} feature="GPA prediction">
                <GpaWhatIf
                  courses={courses}
                  assessments={assessments}
                  courseId={course.id}
                />
              </PaywallLock>
            </div>
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

/** The main column for a manually-created course. Empty → the setup editor (add
 * your first assessments). Once it has assessments it becomes a normal, gradeable
 * course: the Grades/Notes table is the main view (mark complete, enter grades),
 * with structure editing (type/date/weight, add/remove) tucked behind an expander
 * so it never feels like a perpetual setup form. */
function ManualCourseAssessments({
  courseId,
  assessments,
  focusId,
}: {
  courseId: string
  assessments: Assessment[]
  focusId?: string
}) {
  const empty = assessments.length === 0
  // Start in edit mode while setting up; once there are assessments and the
  // student clicks "Done editing", the clean grade table takes over.
  const [editing, setEditing] = useState(empty)

  return (
    <div className="flex flex-col gap-3">
      {!empty ? (
        <button
          type="button"
          data-tour="assess-editor"
          onClick={() => setEditing((o) => !o)}
          aria-expanded={editing}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left transition-colors duration-150',
            editing
              ? 'border-accent/50 bg-accent-soft/40 text-fg'
              : 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2/50',
          )}
        >
          <Pencil size={15} className="shrink-0 text-accent" aria-hidden />
          <span className="flex-1 truncate text-[13px] font-semibold">
            {editing ? 'Done editing' : 'Add or edit assessments'}
            <span className="ml-1.5 text-[12px] font-normal text-subtle">type · date · weight</span>
          </span>
          <ChevronDown
            size={18}
            className={cn('shrink-0 text-muted transition-transform duration-150', editing && 'rotate-180')}
            aria-hidden
          />
        </button>
      ) : null}

      {empty || editing ? <ManualAssessmentEditor courseId={courseId} /> : null}
      {!empty ? <AssessmentTable assessments={assessments} focusId={focusId} /> : null}
    </div>
  )
}
