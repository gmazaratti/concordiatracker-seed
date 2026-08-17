import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Plus, Rows3, Upload } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import type { CoursesView } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { currentTermName, isUpcomingTerm } from '@/features/planner/past-terms'
import { coursePercent, currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { daysUntil } from '@/lib/date'
import { useT } from '@/i18n/i18n'
import { cn } from '@/lib/cn'
import { CourseCard } from './CourseCard'
import { CourseGridCard } from './CourseGridCard'
import { TermGlance } from './TermGlance'
import { PaywallCallout } from './Paywall'
import { AddCourseChooser } from './AddCourseChooser'
import { TranscriptView } from './TranscriptView'
import { AddForTerm, UpcomingCourses } from './UpcomingTerms'

/** Courses — the grade hub. The class list switches between a dense List (rows)
 * and a Google-Classroom Grid (colored cards); the choice sticks across SPA nav.
 * A term-standing rail sits alongside, in the same two-column language as Today. */
export function CoursesPage() {
  const t = useT()
  const { plan, courses, pastCourses, assessments, coursesView, setCoursesView } = useAppData()
  const [chooserOpen, setChooserOpen] = useState(false)
  const [tab, setTab] = useState<'current' | 'upcoming' | 'past'>('current')
  const showPast = tab === 'past'

  /**
   * Courses split into the term you are running and terms you are about to.
   *
   * A course entered for next term is not archived - it has not happened yet -
   * so without this it sat in "This term" alongside the classes you are
   * actually attending, with nothing to tell them apart. Which is exactly where
   * it went missing.
   */
  const upcoming = useMemo(
    () => courses.filter((c) => c.term && isUpcomingTerm(c.term) && c.term !== currentTermName()),
    [courses],
  )
  const thisTerm = useMemo(
    () => courses.filter((c) => !upcoming.includes(c)),
    [courses, upcoming],
  )
  const shown = tab === 'upcoming' ? upcoming : thisTerm

  const byCourse = useMemo(() => {
    const map = new Map<string, typeof assessments>()
    for (const c of courses) map.set(c.id, [])
    for (const a of assessments) map.get(a.courseId)?.push(a)
    return map
  }, [courses, assessments])

  const gpa = useMemo(() => currentGpa(courses, assessments), [courses, assessments])
  const open = assessments.filter((a) => isOpen(a.status))
  const coursesGraded = courses.filter(
    (c) => coursePercent(byCourse.get(c.id) ?? []) !== null,
  ).length
  const credits = courses.reduce((sum, c) => sum + c.credits, 0)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-5 sm:px-6">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] text-subtle">
            {tab === 'upcoming' ? 'Terms ahead' : term.name}
          </p>
          <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
            {t('courses.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'upcoming' && <AddForTerm />}
          {!showPast && tab !== 'upcoming' && (
            <ViewToggle view={coursesView} onChange={setCoursesView} />
          )}
          {/* Shortcut straight to the blueprint browser: the real import path
              (find a classmate's/teacher's outline). */}
          <Link
            to="/app/courses/blueprints"
            data-coach="add-course"
            data-tour="import-course"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
          >
            <Upload size={15} aria-hidden />
            {t('courses.importSyllabus')}
          </Link>
        </div>
      </header>

      {/* This term ⇄ Past semesters. Stays inside Courses (the app keeps exactly
          four top-level destinations). */}
      <div role="tablist" aria-label={t('courses.termsAria')} className="mb-4 flex gap-1 border-b border-border">
        {([
          { id: 'current', label: t('courses.thisTerm') },
          // Always offered, even empty. It used to appear only once it had
          // something in it, so the feature was invisible to exactly the people
          // who needed telling it existed — you cannot find the place to enter
          // next term's classes if that place only appears after you have
          // entered them.
          {
            id: 'upcoming',
            label: upcoming.length > 0 ? `Upcoming (${upcoming.length})` : 'Upcoming',
          },
          {
            id: 'past',
            label: `${t('courses.pastSemesters')}${pastCourses.length ? ` (${pastCourses.length})` : ''}`,
          },
        ] as const).map((item) => {
          const active = item.id === tab
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className={cn(
                'border-b-2 px-3.5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      {showPast && <TranscriptView />}

      {/* Upcoming is its own view, not the current-term grid with a filter: it
          has no rail, because a GPA and an overdue count for classes that have
          not started would both read zero and mean nothing. */}
      {tab === 'upcoming' && <UpcomingCourses courses={upcoming} byCourse={byCourse} />}

      <div
        className={cn(
          'flex flex-col gap-4 lg:flex-row lg:items-start',
          tab !== 'current' && 'hidden',
        )}
      >
        <main className="order-2 min-w-0 flex-1 lg:order-1">
          {coursesView === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {shown.map((c) => (
                <CourseGridCard
                  key={c.id}
                  course={c}
                  assessments={byCourse.get(c.id) ?? []}
                />
              ))}
              <AddCourseCard onClick={() => setChooserOpen(true)} />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {/* `shown`, not `courses` — the list view was ignoring the tab
                  and showing next term's classes alongside this term's. */}
              {shown.map((c) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  assessments={byCourse.get(c.id) ?? []}
                />
              ))}
              <AddCourseRow onClick={() => setChooserOpen(true)} />
            </div>
          )}
        </main>

        <aside className="order-1 flex flex-col gap-3 lg:order-2 lg:w-[272px] lg:shrink-0">
          <TermGlance
            termName={term.name.split(' ')[0]}
            gpa={gpa}
            credits={credits}
            coursesGraded={coursesGraded}
            coursesTotal={courses.length}
            openItems={open.length}
            overdue={open.filter((a) => daysUntil(a.due) < 0).length}
          />
          {plan === 'free' && <PaywallCallout />}
        </aside>
      </div>

      {chooserOpen && <AddCourseChooser onClose={() => setChooserOpen(false)} />}
    </div>
  )
}

/** The "+" tile at the end of the grid — matches a course card's footprint, but
 * dashed + muted so it reads as an action, not a class. Opens the add chooser. */
function AddCourseCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[150px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface/40 px-4 py-5 text-center transition-colors duration-150 hover:border-accent/60 hover:bg-surface-2"
    >
      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-muted transition-colors duration-150 group-hover:bg-accent-soft group-hover:text-accent">
        <Plus size={20} aria-hidden />
      </span>
      <span className="text-[13px] font-medium text-muted transition-colors duration-150 group-hover:text-fg">
        Add a course
      </span>
    </button>
  )
}

/** The List-view counterpart to the "+" card — a dashed action row. */
function AddCourseRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-surface/40 px-4 py-3 text-left transition-colors duration-150 hover:border-accent/60 hover:bg-surface-2"
    >
      <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-muted transition-colors duration-150 group-hover:bg-accent-soft group-hover:text-accent">
        <Plus size={16} aria-hidden />
      </span>
      <span className="text-[13px] font-medium text-muted transition-colors duration-150 group-hover:text-fg">
        Add a course
      </span>
    </button>
  )
}

const VIEW_OPTIONS: { value: CoursesView; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: Rows3 },
]

/** Segmented List | Grid switch — the Courses layout option. */
function ViewToggle({
  view,
  onChange,
}: {
  view: CoursesView
  onChange: (view: CoursesView) => void
}) {
  const t = useT()
  return (
    <div
      role="radiogroup"
      aria-label={t('courses.layoutAria')}
      className="flex gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {VIEW_OPTIONS.map((opt) => {
        const active = view === opt.value
        const Icon = opt.icon
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${opt.label} view`}
            title={`${opt.label} view`}
            onClick={() => onChange(opt.value)}
            className={cn(
              'grid size-7 place-items-center rounded-md transition-colors duration-150',
              active
                ? 'bg-surface-2 text-fg'
                : 'text-subtle hover:text-fg',
            )}
          >
            <Icon size={15} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}
