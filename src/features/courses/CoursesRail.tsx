import { Link } from 'react-router-dom'
import type { Assessment, Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * Beside the class grid: where you stand (this term and overall, kept apart
 * because they answer different questions) and the next few things due across
 * every class, so the page says what to do next without opening five cards.
 */
export function CoursesRail({
  gpa,
  overallGpa,
  credits,
  overallCredits,
  next,
  courses,
  detailBase,
}: {
  gpa: number | null
  overallGpa: number | null
  credits: number
  overallCredits: number
  /** Open, dated, not overdue, soonest first. */
  next: Assessment[]
  courses: Course[]
  detailBase: string
}) {
  return (
    <>
      <section className="ct-res-in rounded-3xl border border-border bg-surface p-5">
        <h2 className="font-display text-[16px] font-semibold text-fg">Where you stand</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2.5">
          <Stat label="This term" value={gpa === null ? 'No grades' : gpa.toFixed(2)} sub={`${credits} credits`} />
          <Stat label="Overall" value={overallGpa === null ? 'No grades' : overallGpa.toFixed(2)} sub={`${overallCredits} credits`} />
        </dl>
      </section>

      <section className="ct-res-in overflow-hidden rounded-3xl border border-border bg-surface">
        <h2 className="px-5 pt-5 pb-2 font-display text-[16px] font-semibold text-fg">Due next, across your classes</h2>
        {next.length === 0 ? (
          <p className="px-5 pb-5 text-[13px] leading-relaxed text-muted">Nothing with a date is waiting on you.</p>
        ) : (
          <ul className="pb-2">
            {next.map((a) => {
              const c = courses.find((x) => x.id === a.courseId)
              return (
                <li key={a.id}>
                  <Link
                    to={`${detailBase}/${a.courseId}`}
                    state={{ focus: a.id }}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-surface-2/50"
                  >
                    <span className="h-9 w-1 shrink-0 rounded-full bg-subtle" style={c ? { backgroundColor: courseColor(c.color).hex } : undefined} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-fg">{a.title}</span>
                      <span className="block truncate text-[12px] text-muted">
                        {c?.code} · {a.weight}%
                      </span>
                    </span>
                    <span className={cn('shrink-0 text-[12.5px] font-semibold', a.due && daysUntil(a.due) <= 1 ? 'text-warning' : 'text-muted')}>
                      {relativeDueLabel(a.due)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-canvas/60 px-3.5 py-3">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-[22px] leading-tight font-bold text-fg tabular-nums">{value}</dd>
      <dd className="text-[11.5px] text-subtle tabular-nums">{sub}</dd>
    </div>
  )
}
