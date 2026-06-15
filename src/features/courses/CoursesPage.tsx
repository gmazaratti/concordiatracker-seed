import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { coursePercent, currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { daysUntil } from '@/lib/date'
import { CourseCard } from './CourseCard'
import { TermGlance } from './TermGlance'
import { PaywallCallout } from './Paywall'

const IMPORT_TARGET = 'hist203'

/** Courses — the grade hub. A scannable list of course cards (main column) with
 * a term-standing rail, in the same two-column language as Today. */
export function CoursesPage() {
  const { plan, courses, assessments } = useAppData()

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
        <Link
          to={`/app/courses/${IMPORT_TARGET}`}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
        >
          <Upload size={15} aria-hidden />
          Import syllabus
        </Link>
      </header>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <main className="order-2 min-w-0 flex-1 lg:order-1">
          <div className="flex flex-col gap-2.5">
            {courses.map((c) => (
              <CourseCard
                key={c.id}
                course={c}
                assessments={byCourse.get(c.id) ?? []}
              />
            ))}
          </div>
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
    </div>
  )
}
