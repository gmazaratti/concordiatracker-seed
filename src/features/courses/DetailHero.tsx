import { Link } from 'react-router-dom'
import { ChevronLeft, Clock, MapPin, Upload, UserRound } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { courseStanding, percentToGrade } from '@/lib/gpa'
import { courseColor } from '@/lib/course-color'
import { courseBanner, courseIcon } from '@/lib/course-style'
import { relativeDueLabel } from '@/lib/date'
import { CourseStylePicker } from './CourseStylePicker'
import { CODE_PILL } from './code-pill'
import { courseStats } from './course-stats'

/**
 * The banner of a class page: the class's own colour or gradient with
 * its icon as a watermark, who teaches it and when it meets under the title,
 * the grade set large on the right, and a strip of the four facts you check
 * most (how much is graded, what is open, what is late, what is next).
 */
export function DetailHero({
  course,
  assessments,
  backTo,
  onImport,
  onOpen,
}: {
  course: Course
  assessments: Assessment[]
  backTo: string
  onImport: () => void
  /** Opens an assessment's editor: the "next due" cell is a way into it. */
  onOpen: (id: string) => void
}) {
  const standing = courseStanding(assessments)
  const stats = courseStats(assessments)
  const graded = standing.currentPercent === null ? null : percentToGrade(standing.currentPercent)
  const gradedPct = standing.totalWeight === 0 ? 0 : Math.round((standing.gradedWeight / standing.totalWeight) * 100)
  const banner = courseBanner(courseColor(course.color).hex, course.gradient)
  const Icon = courseIcon(course.icon)?.icon
  const meta = [
    { icon: UserRound, text: course.instructor?.name },
    { icon: Clock, text: course.meetingTimes },
    { icon: MapPin, text: course.location },
  ].filter((m) => m.text && m.text.trim())

  return (
    // Not overflow-hidden: the style picker opens out of this banner. The
    // watermark and the washes are clipped by their own rounded layer instead.
    <header className="ct-res-in relative isolate rounded-3xl text-white" style={{ backgroundImage: banner.backgroundImage }}>
      <span aria-hidden className="absolute inset-0 -z-10 overflow-hidden rounded-3xl">
        <span className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        {Icon && <Icon strokeWidth={1.2} className="absolute -right-6 -bottom-10 size-72 rotate-[-10deg] text-white/15" />}
      </span>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5 px-5 pt-5 pb-5 sm:px-8 sm:pt-6">
        <div className="min-w-0">
          <Link to={backTo} className="inline-flex items-center gap-1 text-[13px] font-medium text-white/80 transition-colors duration-150 hover:text-white">
            <ChevronLeft size={15} aria-hidden /> Courses
          </Link>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
            <span className={CODE_PILL}>{course.code || 'New course'}</span>
            <span className="text-white/85">
              {course.term} · {course.credits} credits
            </span>
          </div>
          <h1 className="mt-2.5 max-w-3xl font-display text-[30px] leading-[1.05] font-bold tracking-tight text-balance sm:text-[40px]">
            {course.title || 'Untitled course'}
          </h1>
          {meta.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13.5px] text-white/85">
              {meta.map(({ icon: M, text }) => (
                <li key={text} className="inline-flex items-center gap-1.5">
                  <M size={14} className="text-white/65" aria-hidden /> {text}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
            <CourseStylePicker course={course} />
            <button
              type="button"
              onClick={onImport}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-2 text-[13px] font-semibold backdrop-blur-md transition-colors duration-150 hover:bg-white/25"
            >
              <Upload size={14} aria-hidden /> Import an outline
            </button>
          </div>
        </div>

        <div className="shrink-0 sm:text-right">
          {graded ? (
            <>
              <p className="font-display text-[64px] leading-[0.9] font-bold tabular-nums sm:text-[84px]">
                {Math.round(standing.currentPercent!)}%
              </p>
              <p className="mt-1.5 text-[15px] font-semibold text-white/90">
                {graded.letter} · {graded.points.toFixed(1)} points
              </p>
            </>
          ) : (
            <p className="text-[15px] text-white/85">Not graded yet</p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-b-3xl bg-white/10 text-[13px] sm:grid-cols-4">
        <Fact label="Of the grade is in" value={`${gradedPct}%`} bar={gradedPct} />
        <Fact label="Still to hand in" value={String(stats.openCount)} />
        <Fact label="Overdue" value={String(stats.overdueCount)} alert={stats.overdueCount > 0} />
        <Fact
          label={stats.nextDue ? stats.nextDue.title : 'Next due'}
          value={stats.nextDue ? relativeDueLabel(stats.nextDue.due).replace(/^Due /, '') : 'Nothing'}
          onClick={stats.nextDue ? () => onOpen(stats.nextDue!.id) : undefined}
        />
      </dl>
    </header>
  )
}

function Fact({
  label,
  value,
  bar,
  alert,
  onClick,
}: {
  label: string
  value: string
  bar?: number
  alert?: boolean
  onClick?: () => void
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
      className={`min-w-0 bg-black/35 px-5 py-3.5 backdrop-blur-md sm:px-6 ${onClick ? 'cursor-pointer transition-colors duration-150 hover:bg-black/20 focus-visible:bg-black/20 focus-visible:outline-none' : ''}`}
    >
      <dd className={`truncate font-display text-[22px] leading-tight font-bold tabular-nums first-letter:uppercase ${alert ? 'text-[#ff8a8a]' : ''}`}>
        {value}
      </dd>
      <dt className="truncate text-[12px] text-white/70">{label}</dt>
      {bar !== undefined && (
        <span aria-hidden className="mt-2 block h-1 overflow-hidden rounded-full bg-white/20">
          <span className="block h-full rounded-full bg-white" style={{ width: `${bar}%` }} />
        </span>
      )}
    </div>
  )
}
