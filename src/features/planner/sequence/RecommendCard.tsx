import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, Plus, X } from 'lucide-react'
import { browseCourses, coursesByCodes } from '@/lib/catalog'
import { autoPlace, planKey, type CoursePlan, type PlanCourse } from '@/lib/course-plan'
import { parsePrereq, type Prereq } from '@/lib/prereq'
import { recommend, type Suggestion } from '@/lib/recommend'
import { useProgramForUser } from '../useProgramForUser'

type Base = { completed: Set<string>; inProgress: Set<string>; credits: number; inProgressCredits?: number }
interface Loaded {
  suggestions: Suggestion[]
  prereqs: Map<string, Prereq>
}

/** Electives are a long list of "anything matching"; a handful is a suggestion, forty is a catalogue. */
const MAX_ELECTIVES = 6

/**
 * "Recommend": what your programme still asks for, laid out over the coming
 * terms so each course lands after its prerequisites.
 *
 * It reads the requirements in My programme and nothing else: required
 * courses you have not done, then a few that fill an elective rule. Every row
 * says why it is there. Nothing is added until you press Add.
 */
export function RecommendCard({
  plan,
  base,
  onAdd,
  onAddAll,
  onClose,
}: {
  plan: CoursePlan
  base: Base
  onAdd: (index: number, course: PlanCourse) => void
  onAddAll: (items: { index: number; course: PlanCourse }[]) => void
  onClose: () => void
}) {
  const program = useProgramForUser()
  const [data, setData] = useState<Loaded | null>(null)
  const [waited, setWaited] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 2500)
    return () => window.clearTimeout(id)
  }, [])

  const taken = useMemo(() => [...base.completed, ...base.inProgress], [base])
  useEffect(() => {
    if (!program) return
    let alive = true
    const subjects = [
      ...new Set(program.groups.flatMap((g) => [...(g.pattern ? [g.pattern.subject] : []), ...g.courses.map((c) => c.code.split(/[\s-]/)[0])])),
    ]
    void browseCourses({ subjects, limit: 400 }).then(async ({ rows }) => {
      if (!alive) return
      const all = recommend(
        {
          program,
          taken,
          catalog: rows.map((r) => ({ subject: r.subject, catalog: r.catalog, title: r.title, credits: r.class_unit ?? 3, prerequisites: r.prerequisites })),
        },
        200,
      )
      const required = all.filter((s) => s.reason === 'required')
      const electives = all.filter((s) => s.reason === 'elective').slice(0, MAX_ELECTIVES)
      const suggestions = [...required, ...electives]
      // Prerequisites are looked up for exactly the suggested courses: the
      // browse above is capped, and a course missing from it would be placed
      // as if it needed nothing.
      const exact = await coursesByCodes(suggestions.map((s) => s.code))
      if (!alive) return
      setData({
        suggestions,
        prereqs: new Map([...rows, ...exact].map((r) => [planKey(`${r.subject}${r.catalog}`), parsePrereq(r.prerequisites, `${r.subject} ${r.catalog}`)])),
      })
    })
    return () => {
      alive = false
    }
  }, [program, taken])

  const laid = useMemo(() => {
    if (!data) return null
    const why = new Map(data.suggestions.map((s) => [planKey(s.code), s.because]))
    const { placed, left } = autoPlace(
      plan,
      data.suggestions.map((s) => ({ code: s.code, title: s.title, credits: s.credits })),
      base,
      data.prereqs,
    )
    return { placed, left, why }
  }, [data, plan, base])

  const shell = (body: React.ReactNode, action?: React.ReactNode) => (
    <section className="ct-res-in rounded-3xl border border-accent/40 bg-surface p-4 sm:p-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-semibold text-fg">Recommended for your programme</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-subtle">
            {program ? `From the requirements of ${program.name}, placed so each course comes after its prerequisites.` : 'Built from the requirements in My programme.'}
          </p>
        </div>
        {action}
        <button type="button" onClick={onClose} aria-label="Close recommendations" className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="mt-3">{body}</div>
    </section>
  )

  if (!program) {
    return shell(
      waited ? (
        <p className="text-[13px] leading-relaxed text-muted">
          We need to know your programme to recommend courses.{' '}
          <Link to="/app/planner?tab=program" className="font-medium text-accent hover:underline">
            Pick it in My programme
          </Link>
          , then come back.
        </p>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-subtle">
          <Loader2 size={13} className="animate-spin" aria-hidden /> Reading your programme
        </p>
      ),
    )
  }
  if (!laid) {
    return shell(
      <p className="flex items-center gap-2 text-[13px] text-subtle">
        <Loader2 size={13} className="animate-spin" aria-hidden /> Working out what is left
      </p>,
    )
  }
  if (laid.placed.length === 0 && laid.left.length === 0) {
    return shell(
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Check size={14} className="text-success" aria-hidden /> Everything your programme names is finished, in progress, or already in the plan.
      </p>,
    )
  }

  const byTerm = plan.terms.map((t, i) => ({ term: t.term, index: i, rows: laid.placed.filter((p) => p.index === i) })).filter((g) => g.rows.length > 0)
  return shell(
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {byTerm.map((g) => (
          <div key={g.term}>
            <p className="text-[12px] font-semibold tracking-wide text-subtle uppercase">{g.term}</p>
            <ul className="mt-1.5 space-y-1.5">
              {g.rows.map(({ course }) => (
                <li key={course.code} className="flex items-start gap-2 rounded-xl bg-canvas px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-fg">
                      <span className="font-semibold">{course.code}</span>
                      <span className="ml-1.5 text-[11.5px] text-subtle tabular-nums">{course.credits} cr</span>
                    </p>
                    <p className="truncate text-[12px] text-subtle">{course.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{laid.why.get(planKey(course.code))}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(g.index, course)}
                    aria-label={`Add ${course.code} to ${g.term}`}
                    className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent transition-colors duration-150 hover:bg-accent hover:text-accent-contrast"
                  >
                    <Plus size={12} aria-hidden /> Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {laid.left.length > 0 && (
        <p className="mt-3 text-[12px] leading-relaxed text-subtle">
          Not placed: {laid.left.map((c) => c.code).join(', ')}. Either a prerequisite is not in your plan yet, or the terms are full. Add a
          term, or add the course yourself.
        </p>
      )}
      <p className="mt-3 text-[11.5px] leading-relaxed text-subtle">
        Up to 15 credits a term, work terms skipped. Elective rules that are written as prose are not read, so those credits are yours to choose.
      </p>
    </>,
    laid.placed.length > 1 ? (
      <button
        type="button"
        onClick={() => onAddAll(laid.placed)}
        className="shrink-0 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
      >
        Add all {laid.placed.length}
      </button>
    ) : undefined,
  )
}
