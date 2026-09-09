import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, ListChecks, Loader2, Pencil, Upload } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
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
import { SyllabusUploadPage } from './SyllabusUpload'
import { ModalShell } from '@/command/ModalShell'
import { currentTermName, isUpcomingTerm } from '@/features/planner/past-terms'

/** Course detail — the grade workspace. An empty course leads with the syllabus
 * parse-reveal (the hero); a populated one is a two-column editor: a LEFT panel
 * (class details + grade breakdown + grade-needed FREE + GPA what-if PAID) beside
 * the assignment list, stacked on mobile in Today's layout language. */
export function CourseDetailPage() {
  const { courseId } = useParams()
  const location = useLocation()
  const state = location.state as {
    focus?: string
    importItems?: Assessment[]
    /** Instructor, office hours and room from the outline. Blanks only. */
    importDetails?: Partial<Course>
    /** Set by "add a class": land with the section picker already open, so the
     *  schedule Concordia publishes fills itself instead of waiting for someone
     *  to notice a small link and type it out by hand. */
    autofill?: boolean
  } | null
  const focusId = state?.focus
  const importItems = state?.importItems
  const importDetails = state?.importDetails
  const {
    plan,
    courses,
    assessments,
    dataLoading,
    courseById,
    addAssessments,
    updateCourse,
    peerCorrections,
  } = useAppData()
  const navigate = useNavigate()
  const course = courseId ? courseById(courseId) : undefined
  /** Opt-in for the rare student who has next term's syllabus already. Hoisted
   *  above the early returns below, because hooks cannot follow them. */
  const [outlineEarly, setOutlineEarly] = useState(false)
  // Above the `dataLoading` / `!course` early returns, like its neighbour —
  // rules-of-hooks, and the same trap that caught `outlineEarly`.
  /** Adding a second outline to a course that already has one. */
  const [importing, setImporting] = useState(false)
  // Read once, on mount. Kept in state rather than off `location.state` on every
  // render so closing the picker sticks — the router entry is not rewritten.
  const [autoFill] = useState(() => !!state?.autofill)

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
    // The outline's own page-one details, if it carried any and the fields are
    // still blank. Written after the assessments so a failure here cannot cost
    // the import that actually matters.
    if (importDetails && Object.keys(importDetails).length > 0) {
      updateCourse(courseId2, importDetails)
    }
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
      {/* Pinned, not parked in a box of its own.
          The previous attempt made this page a fixed-height container with each
          column scrolling inside it, which meant the panels each had their own
          scrollbar and the assessment column had none at all — it was simply
          clipped. `sticky` gets the same thing the right way: ONE scroll region
          (the page), every panel at its full height, and the banner staying put
          while they all move together. Losing the banner is how you end up
          entering a mark on the wrong course. */}
      <div className="lg:sticky lg:top-0 lg:z-20 lg:-mx-5 lg:-mt-5 lg:bg-canvas lg:px-5 lg:pt-5 lg:pb-3 lg:sm:-mx-6 lg:sm:px-6">
        <CourseHeader course={course} currentPercent={standing.currentPercent} />
      </div>

      <CourseAnnouncements courseCode={course.code} />

      {importing && (
        <ModalShell
          label={`Import an outline into ${course.code}`}
          onClose={() => setImporting(false)}
          widthClass="sm:max-w-2xl"
        >
          <SyllabusUploadPage intoCourseId={course.id} onDone={() => setImporting(false)} />
        </ModalShell>
      )}

      {holding ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          {/* Sticks on desktop: the class details and the grade maths are what
              you read the assessment list AGAINST, and scrolling them off the
              top is what made the page feel like it moved instead of the
              content. Its own scrollbar, since the aside can outgrow the
              viewport on a course with a long breakdown. */}
          <aside className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
            <CourseInfoPanel
              autoFill={autoFill}
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
              autoFill={autoFill}
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
                autoFill={autoFill}
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
            {/* A course with an outline could not receive another one, so a
                corrected syllabus meant retyping it. Anything that looks like an
                assessment already here is flagged and skipped, so importing
                twice cannot double your grade breakdown. */}
            <div className="flex justify-end print:hidden">
              <button
                type="button"
                onClick={() => setImporting(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
              >
                <Upload size={12} aria-hidden />
                Import an outline
              </button>
            </div>
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

/**
 * The main column for a course you are grading.
 *
 * TWO VIEWS OF THE SAME ROWS, and only ever one at a time. It used to render
 * BOTH — the structure editor above the grade table — so four assessments
 * appeared as eight, and the control that swapped them said "Done editing",
 * which reads as a save button on a form that has no save. Two lists of the
 * same thing is the confusion; a labelled switch between them is the fix.
 *
 * Grades is the daily view (mark complete, enter marks). Setup is the
 * occasional one (type, date, weight, add, remove).
 */
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
  // A course with nothing in it has no grades to show, so setup IS the view.
  const [view, setView] = useState<'grades' | 'setup'>(empty ? 'setup' : 'grades')

  return (
    <div className="flex flex-col gap-3">
      {!empty && (
        <div
          role="tablist"
          aria-label="Assessment view"
          data-tour="assess-editor"
          className="flex w-fit gap-0.5 rounded-lg border border-border bg-surface p-0.5"
        >
          {([
            { id: 'grades', label: 'Grades', icon: ListChecks },
            { id: 'setup', label: 'Edit', icon: Pencil },
          ] as const).map((tab) => {
            const Icon = tab.icon
            const on = view === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setView(tab.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150',
                  on ? 'bg-accent-soft text-fg' : 'text-muted hover:text-fg',
                )}
              >
                <Icon size={13} aria-hidden className={cn('shrink-0', on && 'text-accent')} />
                {tab.label}
              </button>
            )
          })}
          <span className="self-center px-2 text-[11.5px] text-subtle">
            {view === 'setup' ? 'type · date · weight' : 'mark complete · enter marks'}
          </span>
        </div>
      )}

      {view === 'setup' ? (
        <ManualAssessmentEditor courseId={courseId} />
      ) : (
        <AssessmentTable assessments={assessments} focusId={focusId} />
      )}
    </div>
  )
}
