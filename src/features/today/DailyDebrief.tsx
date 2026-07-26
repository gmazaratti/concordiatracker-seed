import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Megaphone, Sparkles, TrendingUp } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useTeacher } from '@/app/providers/teacher'
import { buildStudyPlan } from '@/lib/study-plan'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { isOpen } from '@/lib/status'
import { COURSE_COLORS } from '@/lib/course-color'
import { StudyPlanModal } from './StudyPlanModal'
import { cn } from '@/lib/cn'

/** Announcements newer than this are "new". */
const NEW_ANNOUNCEMENT_DAYS = 3

/**
 * The Daily Debrief — a short "here's your situation" read at the top of Today:
 * what's landing next, anything new from your professors, and a one-tap entry to
 * the study plan. Everything is derived from data already on the page, so it's
 * always honest.
 */
export function DailyDebrief() {
  const { courses, assessments } = useAppData()
  const { teacherAnnouncements } = useTeacher()
  const [planOpen, setPlanOpen] = useState(false)

  const plan = useMemo(
    () => buildStudyPlan(courses, assessments, { horizonDays: 7, limit: 3 }),
    [courses, assessments],
  )

  // Weight landing in the next 7 days — the "how heavy is this week" number.
  const weekWeight = useMemo(() => {
    let sum = 0
    for (const a of assessments) {
      if (!isOpen(a.status)) continue
      const d = daysUntil(a.due)
      if (d >= 0 && d <= 7) sum += a.weight
    }
    return Math.round(sum)
  }, [assessments])

  // New announcements for courses the student actually takes.
  const codes = useMemo(() => new Set(courses.map((c) => c.code)), [courses])
  const fresh = useMemo(
    () =>
      teacherAnnouncements
        .filter((a) => codes.has(a.courseCode) && a.postedDaysAgo <= NEW_ANNOUNCEMENT_DAYS)
        .slice(0, 2),
    [teacherAnnouncements, codes],
  )

  const overdue = plan.items.filter((i) => i.daysLeft < 0).length
  // Nothing worth saying → stay out of the way (Today is deliberately calm).
  if (plan.items.length === 0 && fresh.length === 0) return null

  return (
    <>
      <section className="mb-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-fg">Daily debrief</h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{plan.headline}</p>
          </div>
          <button
            type="button"
            onClick={() => setPlanOpen(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
          >
            <Sparkles size={14} aria-hidden />
            Plan my week
          </button>
        </div>

        {/* This week's load */}
        {weekWeight > 0 && (
          <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
            <TrendingUp size={14} className="shrink-0 text-subtle" aria-hidden />
            <span className="font-semibold text-fg">{weekWeight}%</span> of your term grade is due in
            the next 7 days
            {overdue > 0 && (
              <span className="font-medium text-danger"> · {overdue} overdue</span>
            )}
          </p>
        )}

        {/* Next up — the top of the plan, inline */}
        {plan.items.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {plan.items.map((item) => {
              const hex = COURSE_COLORS.find((c) => c.id === item.course?.color)?.hex
              return (
                <li key={item.assessment.id} className="flex items-center gap-2.5 text-[12.5px]">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-fg">{item.assessment.title}</span>
                  <span className="shrink-0 text-[11.5px] text-subtle tabular-nums">
                    {item.assessment.weight}%
                  </span>
                  <span
                    className={cn(
                      'w-20 shrink-0 text-right text-[11.5px]',
                      item.daysLeft < 0 ? 'font-medium text-danger' : 'text-subtle',
                    )}
                  >
                    {relativeDueLabel(item.assessment.due)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}

        {/* Anything new from professors */}
        {fresh.length > 0 && (
          <div className="mt-3.5 border-t border-border pt-3">
            {fresh.map((a) => (
              <p key={a.id} className="flex items-start gap-2 text-[12.5px] leading-relaxed">
                <Megaphone size={14} className="mt-[3px] shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 text-muted">
                  <span className="font-medium text-fg">{a.courseCode}</span> — {a.title}
                </span>
              </p>
            ))}
            <Link
              to="/app/courses"
              className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-medium text-accent hover:underline"
            >
              All announcements
              <ArrowRight size={12} aria-hidden />
            </Link>
          </div>
        )}
      </section>

      {planOpen && <StudyPlanModal onClose={() => setPlanOpen(false)} />}
    </>
  )
}
