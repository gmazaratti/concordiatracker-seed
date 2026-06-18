import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Plus, Rows3, Upload } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import type { CoursesView } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { coursePercent, currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { daysUntil } from '@/lib/date'
import { cn } from '@/lib/cn'
import { CourseCard } from './CourseCard'
import { CourseGridCard } from './CourseGridCard'
import { TermGlance } from './TermGlance'
import { PaywallCallout } from './Paywall'
import { AddCourseChooser } from './AddCourseChooser'

/** Courses — the grade hub. The class list switches between a dense List (rows)
 * and a Google-Classroom Grid (colored cards); the choice sticks across SPA nav.
 * A term-standing rail sits alongside, in the same two-column language as Today. */
export function CoursesPage() {
  const { plan, courses, assessments, coursesView, setCoursesView } = useAppData()
  const [chooserOpen, setChooserOpen] = useState(false)

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
          <p className="text-[12px] text-subtle">{term.name}</p>
          <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
            Courses
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={coursesView} onChange={setCoursesView} />
          {/* Shortcut straight to the upload-syllabus path — names a specific
              method, so it skips the chooser the "+" card opens. */}
          <Link
            to="/app/courses/hist203"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
          >
            <Upload size={15} aria-hidden />
            Import syllabus
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="order-2 min-w-0 flex-1 lg:order-1">
          {coursesView === 'grid' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {courses.map((c) => (
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
              {courses.map((c) => (
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
  return (
    <div
      role="radiogroup"
      aria-label="Course layout"
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
