import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { Course } from '@/data/types'
import { percentToGrade } from '@/lib/gpa'

/** Course-detail hero: identity on the left, headline standing on the right. The
 * rail owns the breakdown; this is the at-a-glance number. */
export function CourseHeader({
  course,
  currentPercent,
}: {
  course: Course
  currentPercent: number | null
}) {
  const graded = currentPercent === null ? null : percentToGrade(currentPercent)
  return (
    <header className="mb-4">
      <Link
        to="/app/courses"
        className="inline-flex items-center gap-1 text-[12px] text-subtle transition-colors duration-150 hover:text-muted"
      >
        <ChevronLeft size={14} aria-hidden />
        Courses
      </Link>
      <div className="mt-1.5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[12px] font-semibold tracking-wide text-muted">
              {course.code}
            </span>
            <span className="text-[12px] text-subtle">
              {course.term} · {course.credits} credits
            </span>
          </div>
          <h1 className="mt-1 font-display text-[24px] leading-tight font-medium text-fg">
            {course.title}
          </h1>
        </div>
        <div className="shrink-0 text-right">
          {graded ? (
            <>
              <div className="font-display text-[28px] leading-none font-semibold text-fg">
                {Math.round(currentPercent!)}%
              </div>
              <div className="mt-0.5 text-[12px] font-medium text-muted">
                {graded.letter} · {graded.points.toFixed(1)} pts
              </div>
            </>
          ) : (
            <span className="text-[12px] text-subtle">Not graded yet</span>
          )}
        </div>
      </div>
    </header>
  )
}
