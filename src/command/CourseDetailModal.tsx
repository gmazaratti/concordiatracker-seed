import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Clock, MapPin, User } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { courseStanding, percentToGrade } from '@/lib/gpa'
import { courseStats } from '@/features/courses/course-stats'
import { courseColor } from '@/lib/course-color'
import { ModalShell } from './ModalShell'

/** The popup the command palette opens for a specific class ("Open a class…").
 * A quick glance — standing, logistics, outstanding work — with a CTA into the
 * full course workspace. The class parity to the assessment popup. */
export function CourseDetailModal({ id }: { id: string }) {
  const { assessments, courseById } = useAppData()
  const { closeTarget } = useQuickActions()
  const navigate = useNavigate()

  const course = courseById(id)
  if (!course) return null

  const courseAssessments = assessments.filter((a) => a.courseId === id)
  const standing = courseStanding(courseAssessments)
  const stats = courseStats(courseAssessments)
  const graded =
    standing.currentPercent === null
      ? null
      : percentToGrade(standing.currentPercent)
  const { hex } = courseColor(course.color)

  function open() {
    navigate(`/app/courses/${id}`)
    closeTarget()
  }

  return (
    <ModalShell label={`${course.code} — ${course.title}`} onClose={closeTarget}>
      <div
        className="px-5 py-4"
        style={{
          backgroundImage: `linear-gradient(125deg, ${hex}, ${hex}cc)`,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide text-white">
            {course.code}
          </span>
          <span className="text-[11px] text-white/80">
            {course.term} · {course.credits} cr
          </span>
        </div>
        <h2 className="mt-1.5 font-display text-[19px] leading-tight font-medium text-white">
          {course.title}
        </h2>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            {graded ? (
              <>
                <span className="text-[22px] leading-none font-semibold text-fg">
                  {Math.round(standing.currentPercent!)}%
                </span>
                <span className="ml-1.5 text-[12px] font-medium text-muted">
                  {graded.letter} · {graded.points.toFixed(1)}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-subtle">Not graded yet</span>
            )}
          </div>
          <span className="text-[12px] text-subtle">
            {stats.openCount > 0 ? (
              <>
                {stats.openCount} open
                {stats.overdueCount > 0 && (
                  <span className="text-danger"> · {stats.overdueCount} overdue</span>
                )}
              </>
            ) : (
              <span className="text-success">All caught up</span>
            )}
          </span>
        </div>

        <dl className="mt-4 space-y-2 text-[13px]">
          <InfoLine icon={User} label={course.instructor.name} />
          <InfoLine icon={Clock} label={course.meetingTimes} />
          <InfoLine icon={MapPin} label={`${course.location} · Section ${course.section}`} />
        </dl>

        <button
          type="button"
          onClick={open}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
        >
          Open course
          <ArrowUpRight size={15} aria-hidden />
        </button>
      </div>
    </ModalShell>
  )
}

function InfoLine({
  icon: Icon,
  label,
}: {
  icon: typeof User
  label: string
}) {
  return (
    <div className="flex items-center gap-2.5 text-muted">
      <Icon size={14} className="shrink-0 text-subtle" aria-hidden />
      <span className="truncate">{label}</span>
    </div>
  )
}
