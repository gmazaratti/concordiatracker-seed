import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, ListChecks, Loader2, Pencil, Upload } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { cn } from '@/lib/cn'
import { PeerSuggestion } from '@/components/PeerSuggestion'
import { MoodleMismatchCard } from './MoodleMismatch'
import { MoodleCourseSection } from '@/features/moodle/MoodleCourseSection'
import { TeacherChangeCard } from './TeacherChangeCard'
import { findMoodleMismatches } from '@/lib/moodle-match'
import { DetailHero } from './DetailHero'
import { CourseInfoPanel } from './CourseInfoPanel'
import { SectionDeadlinesCard } from './SectionDeadlinesCard'
import { SyllabusFileCard } from './SyllabusFileCard'
import { CourseNotesCard } from '@/features/notes/CourseNotesCard'
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

type Pane = 'work' | 'grade' | 'class'
const PANES: { id: Pane; label: string }[] = [
  { id: 'work', label: 'Assessments' },
  { id: 'grade', label: 'Your grade' },
  { id: 'class', label: 'Class details' },
]
const H2 = 'font-display text-[22px] font-semibold tracking-tight text-fg'

/**
 * A class page. A banner (the class's colour, its grade, and four facts, the
 * last of which is what is due next), then two columns: a pinned rail of class
 * details on the left, and on the right the assessment list with the grade
 * tools under it. The grade tools are under the list, not in the rail, so a
 * class with four assessments does not leave half the page empty.
 *
 * On a phone the three parts are tabs, so the list is not buried under the
 * details.
 */
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
  // `?focus=` is the same thing as a link: a notification, a Spotlight result
  // or a shared URL cannot carry router state, only an address.
  const focusId = state?.focus ?? (new URLSearchParams(location.search).get('focus') || undefined)
  const importItems = state?.importItems
  const importDetails = state?.importDetails
  const { plan, courses, assessments, dataLoading, courseById, addAssessments, updateCourse, peerCorrections, personalTasks } =
    useAppData()
  const { openAssessment } = useQuickActions()
  const navigate = useNavigate()
  const course = courseId ? courseById(courseId) : undefined
  // Every hook sits above the early returns below: hooks cannot follow them.
  /** Opt-in for the rare student who has next term's syllabus already. */
  const [outlineEarly, setOutlineEarly] = useState(false)
  /** Adding a second outline to a course that already has one. */
  const [importing, setImporting] = useState(false)
  // Read once, on mount. Kept in state rather than off `location.state` on every
  // render so closing the picker sticks: the router entry is not rewritten.
  const [autoFill] = useState(() => !!state?.autofill)
  const [pane, setPane] = useState<Pane>('work')
  const [mode, setMode] = useState<'grades' | 'setup'>('grades')

  // On a hard refresh the data is still loading. Wait for it before deciding the
  // course doesn't exist, otherwise we'd redirect away from a perfectly valid course.
  if (dataLoading) {
    return (
      <div className="grid h-svh place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (!course) return <Navigate to="/app/courses" replace />

  const mine = assessments.filter((a) => a.courseId === course.id)
  const ids = new Set(mine.map((a) => a.id))
  const corrections = peerCorrections.filter((c) => ids.has(c.assessmentId))
  // Derived live from what is already loaded rather than stored: the
  // disagreement stops existing the moment either side is corrected, so a
  // saved copy of it could only go stale.
  const mismatches = findMoodleMismatches(personalTasks, assessments, courses).filter((m) => ids.has(m.assessmentId))
  const empty = mine.length === 0
  // In practice every course: `createCourse` stamps origin 'manual' on all of them.
  const manual = course.origin === 'manual'
  const id = course.id
  // A class with nothing in it has no grades to enter, so setup is the view.
  const view = manual && empty ? 'setup' : mode

  /**
   * A term that has not started yet.
   *
   * These courses get the class details and nothing else. Outlines are published
   * in the first week, so there is nothing real to enter, and a blueprint from
   * a previous term would hand you dates that are confidently wrong, which is
   * worse than an empty page because you would plan around them. The rare
   * student who genuinely has the syllabus early can say so; everyone else is
   * not shown a form they cannot fill.
   */
  const upcoming = !!course.term && isUpcomingTerm(course.term) && course.term !== currentTermName()
  const holding = upcoming && empty && !outlineEarly && !importItems
  const panes = holding ? PANES.filter((p) => p.id !== 'grade') : PANES

  function completeImport(items: Assessment[]) {
    // Stamp THIS course's id on every item: the blueprint/sample items carry the
    // source's id (or a code), so without this they'd attach to the wrong course.
    addAssessments(items.map((i) => ({ ...i, courseId: id })))
    // The outline's own page-one details, if it carried any and the fields are
    // still blank. Written after the assessments so a failure here cannot cost
    // the import that actually matters.
    if (importDetails && Object.keys(importDetails).length > 0) updateCourse(id, importDetails)
    // Clear the import state so the reveal doesn't replay on the next render.
    if (importItems) navigate(location.pathname, { replace: true, state: focusId ? { focus: focusId } : null })
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-5 py-5 sm:px-6">
      <DetailHero course={course} assessments={mine} backTo="/app/courses" onImport={() => setImporting(true)} onOpen={openAssessment} />
      <CourseAnnouncements courseCode={course.code} />

      {importing && (
        <ModalShell label={`Import an outline into ${course.code}`} onClose={() => setImporting(false)} widthClass="sm:max-w-2xl">
          <SyllabusUploadPage intoCourseId={course.id} onDone={() => setImporting(false)} />
        </ModalShell>
      )}

      {importItems ? (
        // The parse-reveal plays whenever there are in-flight import items (a
        // blueprint import or an uploaded outline), onto any course.
        <SyllabusParseReveal course={course} items={importItems} onComplete={completeImport} autoStart />
      ) : (
        <>
          {/* Phones: one part at a time. From lg up all of them are on screen. */}
          <div role="tablist" aria-label="Parts of this class" className="flex gap-2 overflow-x-auto lg:hidden">
            {panes.map((p) => (
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
            {/* lg:pt-[10px] matches the rail's own top padding (ct-scroll-fade),
                and the heading rows are the same height, so the two headings
                and the two first cards start on the same lines. */}
            <main className={cn('min-w-0 space-y-8 lg:order-2 lg:pt-[10px]', pane === 'class' && 'hidden lg:block')}>
              <div className={cn('space-y-3', pane !== 'work' && 'hidden lg:block')}>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:min-h-10">
                  <h2 className={cn(H2, 'hidden lg:block')}>Assessments</h2>
                  {manual && !empty && <ModeSwitch view={view} onChange={setMode} />}
                </div>
                {holding ? (
                  <Waiting term={course.term} onHaveOutline={() => setOutlineEarly(true)} />
                ) : (
                  <>
                    <TeacherChangeCard items={mine.filter((a) => a.teacherPrev)} />
                    {mismatches.map((m) => (
                      <MoodleMismatchCard key={m.assessmentId} mismatch={m} />
                    ))}
                    {corrections.map((c) => (
                      <PeerSuggestion key={c.assessmentId} correction={c} />
                    ))}
                    {empty && <OutlinePrompt course={course} onUpload={() => setImporting(true)} />}
                    {manual && view === 'setup' ? (
                      <ManualAssessmentEditor courseId={course.id} />
                    ) : (
                      !empty && <AssessmentTable assessments={mine} focusId={focusId} />
                    )}
                  </>
                )}
                <MoodleCourseSection course={course} />
              </div>

              {!holding && (
                <section className={cn('space-y-3', pane !== 'grade' && 'hidden lg:block')}>
                  <h2 className={cn(H2, 'hidden lg:block')}>Your grade</h2>
                  {empty ? (
                    <p className="rounded-3xl border border-dashed border-border-strong px-5 py-6 text-[14px] leading-relaxed text-muted">
                      Your breakdown, the grade you need and the what-if appear once this class has assessments.
                    </p>
                  ) : (
                    // One height per row: each card stretches to the tallest beside it.
                    <div className="grid items-stretch gap-4 *:h-full md:grid-cols-2 2xl:grid-cols-3 [&>*>*]:h-full">
                      <div data-tour="breakdown">
                        <GradeBreakdown assessments={mine} color={course.color} />
                      </div>
                      <div data-tour="grade-needed">
                        <GradeNeeded assessments={mine} />
                      </div>
                      <div
                        data-tour="gpa-predict"
                        // Locked, the card sits two wrappers deeper (the lock, then its blurred copy).
                        className={cn(plan === 'free' && '[&>*>[aria-hidden]]:h-full [&>*>[aria-hidden]>*]:h-full')}
                      >
                        <PaywallLock locked={plan === 'free'} feature="GPA prediction">
                          <GpaWhatIf courses={courses} assessments={assessments} courseId={course.id} />
                        </PaywallLock>
                      </div>
                    </div>
                  )}
                </section>
              )}
            </main>

            {/* The side rail: everything about the class in one place. It stays
                put while the assessment list scrolls, and scrolls on its own (no
                visible bar; the edges fade) when it is taller than the screen. */}
            <aside
              className={cn(
                'ct-scroll-fade ct-no-scrollbar min-w-0 space-y-3 lg:sticky lg:top-4 lg:order-1 lg:max-h-[calc(100svh-2rem)] lg:overflow-y-auto',
                pane !== 'class' && 'hidden lg:block',
              )}
            >
              <h2 className={cn(H2, 'hidden items-center lg:flex lg:min-h-10')}>Class details</h2>
              <div data-tour="course-info">
                <CourseInfoPanel autoFill={autoFill} course={course} totalAssessments={mine.length} editableIdentity={manual} />
              </div>
              <SectionDeadlinesCard course={course} />
              <SyllabusFileCard course={course} />
              <CourseNotesCard course={course} />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Two views of the same rows, only ever one at a time, and each side says what
 * you do there: "Grades / Edit" left people unsure which one takes a mark.
 */
function ModeSwitch({ view, onChange }: { view: 'grades' | 'setup'; onChange: (v: 'grades' | 'setup') => void }) {
  const tabs = [
    { id: 'grades', label: 'Enter grades', icon: ListChecks, hint: 'Tick what you handed in and type your mark on each row' },
    { id: 'setup', label: 'Add or change assessments', icon: Pencil, hint: 'Add or remove assessments, change a type, date or weight. Your marks are kept.' },
  ] as const
  return (
    <div
      role="tablist"
      aria-label="What you are doing with this list"
      data-tour="assess-editor"
      className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1"
    >
      {tabs.map((tab) => {
        const on = view === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            title={tab.hint}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors duration-150',
              on ? 'bg-fg text-canvas' : 'text-muted hover:text-fg',
            )}
          >
            <tab.icon size={14} aria-hidden className="shrink-0" />
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

function OutlinePrompt({ course, onUpload }: { course: Course; onUpload: () => void }) {
  return (
    <div className="rounded-3xl border border-accent/40 bg-accent-soft/60 p-5 sm:p-6">
      <p className="font-display text-[18px] font-semibold text-fg">Got the outline for {course.code || 'this class'}?</p>
      <p className="mt-1 max-w-xl text-[13.5px] leading-relaxed text-muted">
        Upload it and we read the assessments, dates and weights into this class. You review everything before it is
        added.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onUpload}
          className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          <Upload size={15} aria-hidden /> Upload the outline
        </button>
        <Link to={`/app/courses/blueprints?course=${course.id}`} className="text-[13px] font-medium text-muted hover:text-fg">
          or find a classmate&rsquo;s blueprint
        </Link>
      </div>
    </div>
  )
}

function Waiting({ term, onHaveOutline }: { term: string; onHaveOutline: () => void }) {
  return (
    <div className="rounded-3xl border border-dashed border-border-strong px-6 py-12 text-center">
      <CalendarClock size={22} className="mx-auto text-subtle" aria-hidden />
      <p className="mt-3 font-display text-[18px] font-semibold text-fg">Waiting for {term}</p>
      <p className="mx-auto mt-1 max-w-md text-[13.5px] leading-relaxed text-muted">
        This class is saved and out of the way until the term begins. Assignments and dates come from the outline, which
        your professor publishes in the first week, so nothing worth entering exists yet.
      </p>
      <p className="mx-auto mt-2 max-w-md text-[12.5px] leading-relaxed text-subtle">
        You can still fill in the class details whenever you like.
      </p>
      {/* Deliberately quiet. It is the right door for a handful of people and a
          wrong turn for everyone else. */}
      <button
        type="button"
        onClick={onHaveOutline}
        className="mt-4 text-[12.5px] text-subtle underline underline-offset-2 transition-colors duration-150 hover:text-fg"
      >
        I already have the outline
      </button>
    </div>
  )
}
