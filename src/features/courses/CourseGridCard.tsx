import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { courseStanding, percentToGrade } from '@/lib/gpa'
import { relativeDueLabel } from '@/lib/date'
import { courseColor, withAlpha } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import { courseStats } from './course-stats'

/** A course as a Google-Classroom-style card: a colored banner carries the
 * class identity, the body holds standing + the next thing due. The grid layout
 * option on the Courses page. */
export function CourseGridCard({
  course,
  assessments,
}: {
  course: Course
  assessments: Assessment[]
}) {
  const standing = courseStanding(assessments)
  const stats = courseStats(assessments)
  const graded =
    standing.currentPercent === null ? null : percentToGrade(standing.currentPercent)
  const gradedPct =
    standing.totalWeight === 0
      ? 0
      : (standing.gradedWeight / standing.totalWeight) * 100
  const { hex } = courseColor(course.color)
  const empty = assessments.length === 0
  const to = empty
    ? `/app/courses/blueprints?course=${course.id}`
    : `/app/courses/${course.id}`

  return (
    <Link
      to={to}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-shadow duration-150 hover:shadow-lg"
    >
      <div
        className="relative px-4 pt-3.5 pb-4"
        style={{
          backgroundImage: `linear-gradient(125deg, ${hex}, ${withAlpha(hex, 0.8)})`,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">
            {course.code}
          </span>
          <span className="text-[11px] text-white/80">{course.credits} cr</span>
        </div>
        <h3 className="mt-1.5 truncate font-display text-[17px] font-medium text-white">
          {course.title}
        </h3>
      </div>

      <div className="flex flex-1 flex-col px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          {graded ? (
            <div>
              <span className="text-[22px] leading-none font-semibold text-fg">
                {Math.round(standing.currentPercent!)}%
              </span>
              <span className="ml-1.5 text-[12px] font-medium text-muted">
                {graded.letter} · {graded.points.toFixed(1)}
              </span>
            </div>
          ) : (
            <span className="text-[12px] text-subtle">Not graded yet</span>
          )}
        </div>

        {standing.totalWeight > 0 && (
          <div className="mt-2.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{ width: `${gradedPct}%`, backgroundColor: hex }}
              />
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              {Math.round(gradedPct)}% of the grade in
            </p>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-2.5 text-[12px]">
          {stats.openCount > 0 ? (
            <span className="text-muted">
              {stats.openCount} open
              {stats.overdueCount > 0 && (
                <span className="text-danger"> · {stats.overdueCount} overdue</span>
              )}
            </span>
          ) : empty ? (
            <span className="flex items-center gap-1.5 font-medium text-accent">
              <Upload size={13} aria-hidden />
              Import a syllabus
            </span>
          ) : (
            <span className="text-success">All caught up</span>
          )}
          {stats.nextDue && (
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className={cn(
                  'truncate text-subtle',
                  stats.overdueCount > 0 && 'text-danger',
                )}
              >
                {relativeDueLabel(stats.nextDue.due)}
              </span>
              <ProvenanceBadge provenance={stats.nextDue.provenance} />
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
