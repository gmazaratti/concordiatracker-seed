import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, Plus } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import type { Assessment, Course } from '@/data/types'
import { futureTerms, currentTermName } from '@/features/planner/past-terms'
import { CourseGridCard } from './CourseGridCard'

/** The terms you can file a class under here: later ones only. */
function laterTerms(): string[] {
  const now = currentTermName()
  return futureTerms(6).filter((t) => t !== now)
}

/**
 * Add a class to a term you have not started yet.
 *
 * Every other "add a course" in the product means "for the term I am in", which
 * is right nearly always and wrong in exactly the moment a student is looking at
 * their fall registration in July. This is that moment, so the term is the first
 * thing the control asks for rather than something to fix afterwards.
 */
export function AddForTerm() {
  const { createCourse } = useAppData()
  const navigate = useNavigate()
  const terms = laterTerms()
  const [term, setTerm] = useState(terms[0] ?? '')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!term || busy) return
    setBusy(true)
    const id = await createCourse({ term })
    setBusy(false)
    if (id) navigate(`/app/courses/${id}`)
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select
        value={term}
        onChange={setTerm}
        ariaLabel="Term to add to"
        size="sm"
        options={terms.map((t) => ({ value: t, label: t }))}
      />
      <button
        type="button"
        onClick={() => void add()}
        disabled={busy || !term}
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium whitespace-nowrap text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-60"
      >
        <Plus size={14} aria-hidden />
        Add a class
      </button>
    </div>
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
      <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <CalendarPlus size={22} className="mx-auto text-subtle" aria-hidden />
        <p className="mt-3 text-[15px] font-medium text-fg">Nothing lined up yet</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-subtle">
          Already registered for next term? Add those classes here and they will wait until the
          term starts, without touching this term&rsquo;s deadlines or your GPA. You can build the
          outline now and it will be ready on day one.
        </p>
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
  const ordered = [...groups.entries()].sort((a, b) => {
    const all = futureTerms(9)
    return all.indexOf(a[0]) - all.indexOf(b[0])
  })

  return (
    <div className="space-y-6">
      {ordered.map(([termName, list]) => (
        <section key={termName}>
          <h2 className="mb-2.5 flex items-baseline gap-2 text-[13px] font-semibold text-fg">
            {termName}
            <span className="text-[12px] font-normal text-subtle">
              {list.length} class{list.length === 1 ? '' : 'es'}
            </span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {list.map((c) => (
              <CourseGridCard key={c.id} course={c} assessments={byCourse.get(c.id) ?? []} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
