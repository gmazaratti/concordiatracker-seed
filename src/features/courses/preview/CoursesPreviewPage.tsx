import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, BookOpenCheck, GraduationCap, ListTodo, Plus } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useShownGpa } from '@/app/hooks/useShownGpa'
import { term } from '@/data/mock'
import { PHOTOS } from '@/data/resource-photos'
import { currentTermName, isUpcomingTerm } from '@/features/planner/past-terms'
import { courseColor } from '@/lib/course-color'
import { byDue, daysUntil, relativeDueLabel } from '@/lib/date'
import { coursePercent, currentGpa } from '@/lib/gpa'
import { isOpen } from '@/lib/status'
import { cn } from '@/lib/cn'
import { AddCourseChooser } from '../AddCourseChooser'
import { useCourseOrder } from '../useCourseOrder'
import { PreviewCourseCard } from './PreviewCourseCard'

/**
 * PREVIEW ONLY, at /app/courses/preview. Not linked from anywhere.
 *
 * The Courses page in the Planner's look, on your real classes, so it can be
 * judged before anything on the live page changes. It keeps the live page's
 * shape (your classes in a grid, your standing beside them) and shows only the
 * "This term" tab; Upcoming and Past semesters link back to the live page.
 */
export function CoursesPreviewPage() {
  const { courses, pastCourses, assessments } = useAppData()
  const [chooser, setChooser] = useState(false)
  const { sort } = useCourseOrder()
  const showGpa = useShownGpa()

  const shown = useMemo(
    () => sort(courses.filter((c) => !(c.term && isUpcomingTerm(c.term) && c.term !== currentTermName()))),
    [courses, sort],
  )
  const byCourse = useMemo(() => {
    const map = new Map<string, typeof assessments>()
    for (const a of assessments) map.set(a.courseId, [...(map.get(a.courseId) ?? []), a])
    return map
  }, [assessments])

  const gpa = showGpa(currentGpa(courses, assessments))
  const overall = showGpa(currentGpa([...pastCourses, ...courses], assessments))
  const credits = shown.reduce((n, c) => n + c.credits, 0)
  const graded = shown.filter((c) => coursePercent(byCourse.get(c.id) ?? []) !== null).length
  const ids = new Set(shown.map((c) => c.id))
  const open = assessments.filter((a) => ids.has(a.courseId) && isOpen(a.status))
  const overdue = open.filter((a) => !!a.due && daysUntil(a.due) < 0).length
  const next = open.filter((a) => !!a.due && daysUntil(a.due) >= 0).sort(byDue).slice(0, 5)

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 px-5 py-5 sm:px-6">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-dashed border-border-strong px-4 py-2.5 text-[13px] text-muted">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-accent-contrast uppercase">Preview</span>
        A proposed look for Courses, on your real classes. The live page is unchanged.
        <Link to="/app/courses" className="ml-auto inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
          <ArrowLeft size={14} aria-hidden /> Back to the live page
        </Link>
      </p>

      <header className="ct-res-in relative isolate overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
        <img src={PHOTOS.hall.src} alt={PHOTOS.hall.alt} className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover grayscale" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(100deg, rgba(8,10,20,0.95) 0%, rgba(8,10,20,0.85) 42%, rgba(8,10,20,0.45) 78%, rgba(8,10,20,0.3) 100%), linear-gradient(0deg, rgba(8,10,20,0.7), transparent 45%)',
          }}
        />
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">Courses · {term.name}</p>
            <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="font-display text-[60px] leading-[0.9] font-bold tabular-nums sm:text-[76px]">
                {gpa === null ? shown.length : gpa.toFixed(2)}
              </span>
              <span className="pb-1.5 text-[15px] text-white/80">
                {gpa === null
                  ? `${shown.length === 1 ? 'class' : 'classes'} this term. Enter a grade to see your GPA.`
                  : 'term GPA so far'}
              </span>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
              <Chip icon={BookOpenCheck} n={credits} label="credits" />
              <Chip icon={GraduationCap} n={`${graded} of ${shown.length}`} label="classes graded" />
              <Chip icon={ListTodo} n={open.length} label="still to hand in" />
              {overdue > 0 && (
                <li className="inline-flex items-center gap-1.5 rounded-full bg-[#e5484d] px-3 py-1.5 font-semibold">
                  <AlertTriangle size={13} aria-hidden /> {overdue} overdue
                </li>
              )}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setChooser(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13.5px] font-semibold text-black transition-colors duration-150 hover:bg-white/90"
          >
            <Plus size={16} aria-hidden /> Add a course
          </button>
        </div>
      </header>

      <nav aria-label="Terms" className="flex flex-wrap gap-2 text-[13.5px] font-semibold">
        <span className="rounded-full bg-fg px-4 py-2 text-canvas">This term</span>
        <Link to="/app/courses?tab=upcoming" className="rounded-full border border-border px-4 py-2 text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg">
          Upcoming
        </Link>
        <Link to="/app/courses?tab=past" className="rounded-full border border-border px-4 py-2 text-muted transition-colors duration-150 hover:border-border-strong hover:text-fg">
          Past semesters{pastCourses.length ? ` (${pastCourses.length})` : ''}
        </Link>
      </nav>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <main className="order-2 grid min-w-0 flex-1 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:order-1 2xl:grid-cols-3">
          {shown.map((c, i) => (
            <PreviewCourseCard key={c.id} course={c} assessments={byCourse.get(c.id) ?? []} delay={Math.min(i, 8) * 45} />
          ))}
          <button
            type="button"
            onClick={() => setChooser(true)}
            className="group flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border-strong px-4 py-6 text-center transition-colors duration-150 hover:border-accent/60 hover:bg-surface"
          >
            <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted transition-colors duration-150 group-hover:bg-accent group-hover:text-accent-contrast">
              <Plus size={22} aria-hidden />
            </span>
            <span className="text-[14px] font-semibold text-muted transition-colors duration-150 group-hover:text-fg">Add a course</span>
          </button>
        </main>

        <aside className="order-1 space-y-4 lg:order-2 lg:w-[320px] lg:shrink-0">
          <section className="ct-res-in rounded-3xl border border-border bg-surface p-5">
            <h2 className="font-display text-[16px] font-semibold text-fg">Where you stand</h2>
            <dl className="mt-3 grid grid-cols-2 gap-2.5">
              <Stat label="This term" value={gpa === null ? 'No grades' : gpa.toFixed(2)} />
              <Stat label="Overall" value={overall === null ? 'No grades' : overall.toFixed(2)} />
            </dl>
          </section>

          <section className="ct-res-in overflow-hidden rounded-3xl border border-border bg-surface">
            <h2 className="px-5 pt-5 pb-2 font-display text-[16px] font-semibold text-fg">Due next, across your classes</h2>
            {next.length === 0 ? (
              <p className="px-5 pb-5 text-[13px] leading-relaxed text-muted">Nothing with a date is waiting on you.</p>
            ) : (
              <ul className="pb-2">
                {next.map((a) => {
                  const c = shown.find((x) => x.id === a.courseId)
                  return (
                    <li key={a.id}>
                      <Link to={`/app/courses/${a.courseId}`} className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-2/50">
                        <span className="h-9 w-1 shrink-0 rounded-full" style={{ backgroundColor: c ? courseColor(c.color).hex : undefined }} aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-fg">{a.title}</span>
                          <span className="block truncate text-[12px] text-muted">
                            {c?.code} · {a.weight}%
                          </span>
                        </span>
                        <span className={cn('shrink-0 text-[12.5px] font-semibold', daysUntil(a.due!) <= 1 ? 'text-warning' : 'text-muted')}>
                          {relativeDueLabel(a.due)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>

      {chooser && <AddCourseChooser onClose={() => setChooser(false)} />}
    </div>
  )
}

function Chip({ icon: Icon, n, label }: { icon: typeof ListTodo; n: number | string; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
      <Icon size={13} className="text-white/70" aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-white/75">{label}</span>
    </li>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-canvas/60 px-3.5 py-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-[22px] leading-tight font-bold text-fg tabular-nums">{value}</dd>
    </div>
  )
}
