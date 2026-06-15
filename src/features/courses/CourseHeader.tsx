import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import type { Course } from '@/data/types'
import { percentToGrade } from '@/lib/gpa'
import { courseColor, withAlpha } from '@/lib/course-color'
import { CourseColorPicker } from './CourseColorPicker'

/** Course-detail hero — a Google-Classroom-style colored banner. The class's
 * accent color is its identity here: a gradient wash carries code/title in white,
 * with the headline standing on the right and a recolor control. */
export function CourseHeader({
  course,
  currentPercent,
}: {
  course: Course
  currentPercent: number | null
}) {
  const graded = currentPercent === null ? null : percentToGrade(currentPercent)
  const { hex } = courseColor(course.color)

  return (
    <header className="mb-4">
      <Link
        to="/app/courses"
        className="inline-flex items-center gap-1 text-[12px] text-subtle transition-colors duration-150 hover:text-muted"
      >
        <ChevronLeft size={14} aria-hidden />
        Courses
      </Link>

      <div
        className="mt-1.5 rounded-2xl border border-border"
        style={{
          backgroundImage: `linear-gradient(120deg, ${hex}, ${withAlpha(hex, 0.82)})`,
        }}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="rounded bg-white/20 px-1.5 py-0.5 text-[12px] font-semibold tracking-wide text-white">
                {course.code}
              </span>
              <span className="text-[12px] text-white/80">
                {course.term} · {course.credits} credits
              </span>
            </div>
            <h1 className="mt-1.5 font-display text-[26px] leading-tight font-medium text-white">
              {course.title}
            </h1>
            <div className="mt-3">
              <CourseColorPicker courseId={course.id} color={course.color} />
            </div>
          </div>

          <div className="shrink-0 text-right">
            {graded ? (
              <>
                <div className="font-display text-[30px] leading-none font-semibold text-white">
                  {Math.round(currentPercent!)}%
                </div>
                <div className="mt-1 text-[12px] font-medium text-white/85">
                  {graded.letter} · {graded.points.toFixed(1)} pts
                </div>
              </>
            ) : (
              <span className="text-[12px] text-white/85">Not graded yet</span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
