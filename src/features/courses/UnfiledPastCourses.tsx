import { Archive, Undo2 } from 'lucide-react'
import { currentTermName } from '@/features/planner/past-terms'
import type { Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'

/**
 * Courses from a term that is over but were never filed away: an old outline
 * imported before new courses were filed by their term, or a course whose
 * term was edited afterwards. They are left out of "This term" (they are not
 * this term), so this is the one place they show, with a one-tap way to file
 * them. Nothing moves without the tap: archiving freezes the grade.
 */
export function UnfiledPastCourses({ courses }: { courses: Course[] }) {
  const { archiveCourse, moveToCurrentTerm, courses: live } = useAppData()
  if (courses.length === 0) return null
  const nowTerm = currentTermName()
  const key = (code: string) => code.replace(/[\s-]+/g, '').toUpperCase()
  const taken = new Set(live.filter((c) => c.term === nowTerm && c.code).map((c) => key(c.code)))
  return (
    <section className="mb-4 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
      <p className="text-[13px] font-medium text-fg">
        {courses.length === 1 ? 'A course from a finished term' : `${courses.length} courses from finished terms`}{' '}
        {courses.length === 1 ? 'is' : 'are'} still filed as active
      </p>
      <p className="mt-0.5 text-[12px] text-muted">
        Finished? Move them to past semesters so they count on your record. Still taking one? Move it to{' '}
        {nowTerm}; its term was probably set before the new term began.
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-border/60">
        {courses.map((c) => (
          <li key={c.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <span className="min-w-0 truncate text-[13px] text-fg">
              <span className="font-medium">{c.code || 'Untitled'}</span>
              <span className="text-subtle"> · {c.term}</span>
            </span>
            <span className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
              {!(c.code && taken.has(key(c.code))) && (
                <button
                  type="button"
                  onClick={() => moveToCurrentTerm(c.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-fg transition-colors duration-150 hover:border-accent"
                >
                  <Undo2 size={13} aria-hidden />
                  Still taking it
                </button>
              )}
              <button
                type="button"
                onClick={() => archiveCourse(c.id)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[12px] font-medium text-fg transition-colors duration-150 hover:border-accent"
              >
                <Archive size={13} aria-hidden />
                Move to past semesters
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
