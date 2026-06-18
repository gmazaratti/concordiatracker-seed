import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Plus, ShieldCheck } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { outlineWeight, type TeacherCourse } from '@/data/teacher'
import { StatusChip } from '@/layouts/TeacherLayout'
import { LinkCourseModal } from './LinkCourseModal'

/** The teacher's home once signed in — their managed courses + a link/create
 * affordance. Pending accounts can prepare here; publishing is gated downstream. */
export function TeacherDashboard() {
  const { currentTeacher } = useTeacher()
  const [linkOpen, setLinkOpen] = useState(false)
  if (!currentTeacher) return null

  const pending = currentTeacher.status === 'pending'

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-[24px] leading-tight font-semibold text-fg">
            Welcome, {currentTeacher.name}
          </h1>
          <p className="text-[13px] text-subtle">Manage your course outlines and announcements.</p>
        </div>
        <StatusChip status={currentTeacher.status} />
      </header>

      {pending && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[13px] text-warning">
          <strong className="font-semibold">Pending approval.</strong> An admin will review your
          account shortly. You can set up your course outline now — publishing unlocks once you're
          approved.
        </div>
      )}

      <h2 className="mt-6 mb-3 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        My courses
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {currentTeacher.courses.map((c) => (
          <CourseCard key={c.courseId} course={c} />
        ))}
        <button
          type="button"
          onClick={() => setLinkOpen(true)}
          className="flex min-h-[7rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface/40 px-4 py-5 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent/50 hover:text-accent"
        >
          <Plus size={18} aria-hidden />
          Link or create a course
        </button>
      </div>

      {linkOpen && <LinkCourseModal onClose={() => setLinkOpen(false)} />}
    </div>
  )
}

function CourseCard({ course }: { course: TeacherCourse }) {
  const weight = outlineWeight(course.outline)
  const status = course.published
    ? 'published'
    : course.outline.length > 0
      ? 'draft'
      : 'empty'

  return (
    <Link
      to={`/teacher/course/${course.courseId}`}
      className="group flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors duration-150 hover:border-border-strong hover:bg-surface-2"
    >
      <div className="flex items-center gap-2">
        <BookOpen size={15} className="text-accent" aria-hidden />
        <span className="text-[14px] font-semibold text-fg">
          {course.code} · {course.section}
        </span>
      </div>
      <p className="mt-0.5 line-clamp-1 text-[12px] text-subtle">{course.title}</p>

      <div className="mt-3 flex items-center gap-1.5 text-[12px]">
        {status === 'published' ? (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <ShieldCheck size={13} aria-hidden />
            Published
          </span>
        ) : status === 'draft' ? (
          <span className="text-muted">
            Draft · {course.outline.length} item{course.outline.length === 1 ? '' : 's'} · {weight}%
          </span>
        ) : (
          <span className="text-subtle">No outline yet</span>
        )}
      </div>
    </Link>
  )
}
