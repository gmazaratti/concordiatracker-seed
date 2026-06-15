import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { courseStanding, percentToGrade } from '@/lib/gpa'
import { relativeDueLabel } from '@/lib/date'
import { courseColor } from '@/lib/course-color'
import { cn } from '@/lib/cn'
import { courseStats } from './course-stats'

/** One course at a glance: standing (or "not graded yet"), how much weight is
 * locked in, and the next thing due — with its provenance, first-class. */
export function CourseCard({
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

  return (
    <Link
      to={`/app/courses/${course.id}`}
      className="group relative block overflow-hidden rounded-xl border border-border bg-surface py-3.5 pr-4 pl-5 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
    >
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ backgroundColor: hex }}
        aria-hidden
      />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-muted group-hover:bg-surface">
              {course.code}
            </span>
            <span className="text-[12px] text-subtle">{course.credits} cr</span>
          </div>
          <h3 className="mt-1 truncate text-[15px] font-medium text-fg">
            {course.title}
          </h3>
        </div>

        <div className="shrink-0 text-right">
          {graded ? (
            <>
              <div className="text-[18px] leading-tight font-semibold text-fg">
                {Math.round(standing.currentPercent!)}%
              </div>
              <div className="text-[12px] font-medium text-muted">
                {graded.letter} · {graded.points.toFixed(1)}
              </div>
            </>
          ) : (
            <span className="text-[12px] text-subtle">Not graded yet</span>
          )}
        </div>
      </div>

      {standing.totalWeight > 0 && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2 group-hover:bg-surface">
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

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-2.5 text-[12px]">
        <span className="flex items-center gap-2 text-subtle">
          {stats.openCount > 0 ? (
            <>
              <span className="text-muted">
                {stats.openCount} open
                {stats.overdueCount > 0 && (
                  <span className="text-danger"> · {stats.overdueCount} overdue</span>
                )}
              </span>
            </>
          ) : standing.totalWeight === 0 ? (
            <span className="text-accent">Import a syllabus to add dates</span>
          ) : (
            <span className="text-success">All caught up</span>
          )}
        </span>
        {stats.nextDue && (
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'truncate text-muted',
                stats.overdueCount > 0 && 'text-danger',
              )}
            >
              {relativeDueLabel(stats.nextDue.due)}
            </span>
            <ProvenanceBadge provenance={stats.nextDue.provenance} />
          </span>
        )}
        <ChevronRight
          size={16}
          className="shrink-0 text-subtle transition-transform duration-150 group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
    </Link>
  )
}
