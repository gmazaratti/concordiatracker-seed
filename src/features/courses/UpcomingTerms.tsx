import { useState } from 'react'
import { CalendarPlus, Plus } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { termRank } from '@/lib/term'
import { AddUpcomingModal } from './AddUpcomingModal'
import { CourseGridCard } from './CourseGridCard'

/**
 * Add a class to a term you have not started yet.
 *
 * Every other "add a course" in the product means "for the term I am in", which
 * is right nearly always and wrong in exactly the moment a student is looking at
 * their fall registration in July. This is that moment, so the term is the first
 * thing the control asks for rather than something to fix afterwards.
 */
export function AddForTerm({ tone = 'banner' }: { /** On the photo banner, or on the page. */ tone?: 'banner' | 'page' } = {}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          tone === 'banner'
            ? 'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13.5px] font-semibold whitespace-nowrap text-black transition-colors duration-150 hover:bg-white/90 sm:flex-none'
            : 'inline-flex items-center gap-1.5 rounded-full bg-accent px-5 py-2.5 text-[14px] font-semibold whitespace-nowrap text-accent-contrast transition-colors duration-150 hover:bg-accent-hover'
        }
      >
        <Plus size={16} aria-hidden />
        {tone === 'banner' ? 'Add a class' : 'Add next term’s classes'}
      </button>
      {open && <AddUpcomingModal onClose={() => setOpen(false)} />}
    </>
  )
}

/**
 * Classes you are registered in but not yet taking, grouped by term.
 *
 * Deliberately separate from the term you are running: these have no deadlines,
 * no grades and no bearing on your GPA yet, and mixing them into the current
 * term is what made them impossible to find in the first place.
 */
export function UpcomingCourses({
  courses,
  byCourse,
}: {
  courses: Course[]
  byCourse: Map<string, Assessment[]>
}) {
  if (courses.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border-strong px-6 py-14 text-center">
        <CalendarPlus size={22} className="mx-auto text-subtle" aria-hidden />
        <p className="mt-3 font-display text-[20px] font-semibold text-fg">Nothing lined up yet</p>
        <p className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">
          Already registered for next term? Add those classes and they will wait here until the
          term starts, without touching this term&rsquo;s deadlines or your GPA. Assignments come
          later, when the outlines are actually published.
        </p>
        <div className="mt-5">
          <AddForTerm tone="page" />
        </div>
      </div>
    )
  }

  // Grouped and ordered, so "Fall 2026" and "Winter 2027" do not interleave.
  const groups = new Map<string, Course[]>()
  for (const c of courses) {
    const key = c.term ?? 'Later'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  // Ranked, not looked up in a list: a course filed under a term that has since
  // passed is not in the future list at all, and indexOf's -1 sorted it first.
  const ordered = [...groups.entries()].sort((a, b) => termRank(a[0]) - termRank(b[0]))

  return (
    <div className="space-y-6">
      {ordered.map(([termName, list]) => (
        <section key={termName}>
          <h2 className="mb-3 flex items-baseline gap-2 font-display text-[20px] font-semibold tracking-tight text-fg">
            {termName}
            <span className="font-sans text-[13px] font-normal text-muted">
              {list.length} class{list.length === 1 ? '' : 'es'}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {list.map((c) => (
              <CourseGridCard key={c.id} course={c} assessments={byCourse.get(c.id) ?? []} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
