import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Upload } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { courseStanding, percentToGrade } from '@/lib/gpa'
import { relativeDueLabel } from '@/lib/date'
import { courseColor } from '@/lib/course-color'
import { courseBanner, courseIcon } from '@/lib/course-style'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/i18n'
import { courseStats } from './course-stats'
import { CourseCardMenu } from './CourseCardMenu'
import { CODE_PILL } from './code-pill'

/**
 * A class as a card: its own colour or gradient as a banner with its icon as a
 * watermark, the grade as the largest thing in the body, and what is due next
 * in its own row. The grid layout on the Courses page.
 */
export function CourseGridCard({
  course,
  assessments,
  detailBase = '/app/courses',
}: {
  course: Course
  assessments: Assessment[]
  /** Where a card opens. The preview route points this at the preview detail. */
  detailBase?: string
}) {
  const t = useT()
  const standing = courseStanding(assessments)
  const stats = courseStats(assessments)
  const graded = standing.currentPercent === null ? null : percentToGrade(standing.currentPercent)
  const gradedPct = standing.totalWeight === 0 ? 0 : (standing.gradedWeight / standing.totalWeight) * 100
  const banner = courseBanner(courseColor(course.color).hex, course.gradient)
  const Icon = courseIcon(course.icon)?.icon
  const empty = assessments.length === 0
  const to =
    empty && course.origin !== 'manual' ? `/app/courses/blueprints?course=${course.id}` : `${detailBase}/${course.id}`

  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong"
    >
      <div className="relative isolate overflow-hidden px-5 pt-4 pb-5 text-white" style={{ backgroundImage: banner.backgroundImage }}>
        <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/35 to-transparent" />
        {Icon && (
          <Icon aria-hidden strokeWidth={1.4} className="absolute -right-4 -bottom-6 -z-10 size-32 rotate-[-10deg] text-white/20" />
        )}
        <CourseCardMenu
          course={course}
          assessmentCount={assessments.length}
          className="absolute top-3 right-3 z-10"
          triggerClassName="grid size-8 place-items-center rounded-full bg-black/20 text-white/90 backdrop-blur-md transition-colors duration-150 hover:bg-black/35 hover:text-white data-[state=open]:bg-black/35"
        />
        <div className="flex flex-wrap items-center gap-2 pr-10 text-[12px] font-semibold">
          <span className={CODE_PILL}>{course.code || t('courses.newCourse')}</span>
          <span className="text-white/85">{course.credits} credits</span>
          {/* Waitlisted is worth seeing without opening the class: it is the one
              status where the credits on this card may never actually count. */}
          {course.enrollment === 'waitlisted' && <span className={cn(CODE_PILL, 'bg-white/25')}>Waitlisted</span>}
          {course.enrollment === 'planned' && <span className={cn(CODE_PILL, 'border border-white/50 bg-transparent')}>Planned</span>}
        </div>
        <h3 className="mt-6 line-clamp-2 min-h-[3rem] font-display text-[20px] leading-tight font-bold tracking-tight text-balance">
          {course.title || t('courses.untitledCourse')}
        </h3>
      </div>

      <div className="flex flex-1 flex-col px-5 pt-4 pb-4">
        <div className="flex items-end justify-between gap-3">
          {graded ? (
            <p className="flex items-baseline gap-2">
              <span className="font-display text-[38px] leading-none font-bold text-fg tabular-nums">
                {Math.round(standing.currentPercent!)}%
              </span>
              <span className="text-[14px] font-semibold text-muted">{graded.letter}</span>
            </p>
          ) : (
            <p className="text-[14px] text-muted">Not graded yet</p>
          )}
          {stats.overdueCount > 0 ? (
            <span className="rounded-full bg-danger/15 px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap text-danger">
              {stats.overdueCount} overdue
            </span>
          ) : stats.openCount > 0 ? (
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap text-muted">
              {stats.openCount} open
            </span>
          ) : (
            !empty && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[12.5px] font-semibold whitespace-nowrap text-success">
                <CheckCircle2 size={13} aria-hidden /> Caught up
              </span>
            )
          )}
        </div>

        <div className="mt-3.5 min-h-[34px]">
          {standing.totalWeight > 0 ? (
            <>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${gradedPct}%`, backgroundColor: banner.hex }} />
              </div>
              <p className="mt-1.5 text-[12px] text-subtle">{Math.round(gradedPct)}% of the grade is in</p>
            </>
          ) : (
            <p className="text-[12.5px] text-subtle">{empty ? 'Nothing scheduled yet' : 'No weights set yet'}</p>
          )}
        </div>

        <div
          className={cn(
            'mt-auto flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[13px]',
            stats.nextDue ? 'bg-canvas/60' : 'border border-dashed border-border-strong',
          )}
        >
          {stats.nextDue ? (
            <>
              <CalendarClock size={16} className={cn('shrink-0', stats.overdueCount > 0 ? 'text-danger' : 'text-muted')} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-medium text-fg">{stats.nextDue.title}</span>
              <span className={cn('shrink-0 font-semibold', stats.overdueCount > 0 ? 'text-danger' : 'text-muted')}>
                {relativeDueLabel(stats.nextDue.due)}
              </span>
            </>
          ) : empty ? (
            <span className="flex items-center gap-2 font-medium text-accent">
              <Upload size={15} aria-hidden /> {course.origin === 'manual' ? 'Add assessments' : 'Import a syllabus'}
            </span>
          ) : (
            <span className="text-muted">Nothing left to hand in</span>
          )}
        </div>
      </div>
    </Link>
  )
}
