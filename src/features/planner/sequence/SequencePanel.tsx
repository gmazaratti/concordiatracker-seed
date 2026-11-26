import { useEffect, useMemo, useState } from 'react'
import { Briefcase, GraduationCap, ListChecks, Plus, TriangleAlert } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { PHOTOS } from '@/data/resource-photos'
import { summarizeRecord } from '@/lib/academic-record'
import { coursesByCodes } from '@/lib/catalog'
import { checkPlan, planCredits, planKey, termCredits, type CoursePlan } from '@/lib/course-plan'
import { parsePrereq, type Prereq } from '@/lib/prereq'
import { termRank } from '@/lib/term'
import { TermCard, type ShownCourse } from './TermCard'
import { useCoursePlan } from './useCoursePlan'

/**
 * Course sequence: lay out the semesters to come.
 *
 * Each term is a card you fill from Concordia's calendar. Every course is
 * checked against what comes before it (what you have finished, what you are
 * taking now, and what you planned earlier), so a course placed ahead of its
 * prerequisite says so. A term can be marked as a work term.
 *
 * It is a sketch. Nothing is registered, and it does not know which term a
 * course is offered in: Concordia publishes that one term at a time.
 */
export function SequencePanel() {
  const { courses, pastCourses, assessments } = useAppData()
  const { plan, current, add, remove, move, setWork, addTerm, removeLastTerm } = useCoursePlan()
  const [prereqs, setPrereqs] = useState<Map<string, Prereq>>(new Map())

  const now = termRank(current)
  const taking = useMemo(() => courses.filter((c) => c.code.trim() && termRank(c.term) <= now), [courses, now])
  const base = useMemo(() => {
    const summary = summarizeRecord(pastCourses, assessments)
    return {
      completed: new Set(summary.completedCodes.map(planKey)),
      inProgress: new Set(taking.map((c) => planKey(c.code))),
      credits: summary.credits,
      inProgressCredits: taking.reduce((n, c) => n + (c.credits || 0), 0),
    }
  }, [pastCourses, assessments, taking])

  /** The plan as shown: classes already added in Courses for a coming term lead it. */
  const shown = useMemo(
    () =>
      plan.terms.map((t) => {
        const locked: ShownCourse[] = courses
          .filter((c) => c.code.trim() && c.term === t.term)
          .map((c) => ({ code: c.code, title: c.title, credits: c.credits, locked: true }))
        const keys = new Set(locked.map((c) => planKey(c.code)))
        return { ...t, courses: [...locked, ...t.courses.filter((c) => !keys.has(planKey(c.code)))] as ShownCourse[] }
      }),
    [plan, courses],
  )

  const codes = useMemo(() => [...new Set(shown.flatMap((t) => t.courses.map((c) => c.code)))].sort().join('|'), [shown])
  useEffect(() => {
    if (!codes) return
    let alive = true
    void coursesByCodes(codes.split('|')).then((rows) => {
      if (!alive) return
      setPrereqs(new Map(rows.map((r) => [planKey(`${r.subject}${r.catalog}`), parsePrereq(r.prerequisites, `${r.subject} ${r.catalog}`)])))
    })
    return () => {
      alive = false
    }
  }, [codes])

  const checks = useMemo(() => checkPlan({ terms: shown } as CoursePlan, base, prereqs), [shown, base, prereqs])
  const warnings = [...checks.values()].filter((c) => c.verdict === 'missing' || c.verdict === 'blocked').length
  const planned = planCredits({ terms: shown })
  const workTerms = shown.filter((t) => t.work).length
  const last = shown.length - 1

  /** Add a named prerequisite to the term before, with the calendar's title and credits. */
  const fix = async (i: number, code: string) => {
    const [row] = await coursesByCodes([code]).catch(() => [])
    add(i - 1, { code, title: row?.title ?? '', credits: row?.class_unit ?? 3 })
  }

  return (
    <div className="space-y-5">
      <header className="ct-res-in relative isolate overflow-hidden rounded-3xl bg-[#0b0d16] text-white">
        <img src={PHOTOS.tower.src} alt={PHOTOS.tower.alt} className="ct-res-kenburns absolute inset-0 -z-20 size-full object-cover grayscale" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(100deg, rgba(8,10,20,0.95) 0%, rgba(8,10,20,0.85) 42%, rgba(8,10,20,0.45) 78%, rgba(8,10,20,0.3) 100%), linear-gradient(0deg, rgba(8,10,20,0.7), transparent 45%)',
          }}
        />
        <div className="px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
          <p className="text-[12px] font-semibold tracking-[0.14em] text-white/75 uppercase">Course sequence</p>
          <h2 className="mt-2 font-display text-[26px] leading-[1.08] font-bold tracking-tight text-balance sm:text-[32px]">
            Plan the semesters to come
          </h2>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/80">
            Add courses to each term. A course placed before its prerequisite is flagged, and any term can be a work term.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2 text-[12.5px] font-medium">
            <Chip icon={GraduationCap} n={base.credits} label="credits finished" />
            <Chip icon={ListChecks} n={planned} label="credits planned" />
            {workTerms > 0 && <Chip icon={Briefcase} n={workTerms} label={workTerms === 1 ? 'work term' : 'work terms'} />}
            <Chip icon={TriangleAlert} n={warnings} label={warnings === 1 ? 'course out of order' : 'courses out of order'} />
          </ul>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <section className="flex flex-col rounded-3xl border border-border/60 bg-surface/50 p-4">
          <h3 className="font-display text-[17px] leading-tight font-semibold text-fg">{current}</h3>
          <p className="mt-0.5 text-[12px] text-subtle tabular-nums">Now · {base.inProgressCredits} credits</p>
          <ul className="mt-3 space-y-1.5">
            {taking.length === 0 && <li className="rounded-xl bg-canvas px-3 py-4 text-center text-[12.5px] text-subtle">No classes in Courses this term.</li>}
            {taking.map((c) => (
              <li key={c.id} className="rounded-xl bg-canvas px-3 py-2.5">
                <p className="text-[13px] text-fg">
                  <span className="font-semibold">{c.code}</span>
                  <span className="ml-1.5 text-[11.5px] text-subtle tabular-nums">{c.credits} cr</span>
                </p>
                {c.title && <p className="truncate text-[12px] text-subtle">{c.title}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] leading-relaxed text-subtle">The plan assumes you pass what you are taking now.</p>
        </section>

        {shown.map((t, i) => (
          <TermCard
            key={t.term}
            index={i}
            term={t.term}
            work={!!t.work}
            courses={t.courses}
            checks={checks}
            credits={termCredits(t)}
            prevTerm={i > 0 ? shown[i - 1].term : null}
            nextTermName={i < last ? shown[i + 1].term : null}
            canRemove={i === last && shown.length > 1 && t.courses.length === 0}
            onAdd={(c) => add(i, c)}
            onRemove={(code) => remove(i, code)}
            onMove={(code, by) => move(i, code, i + by)}
            onWork={(work) => setWork(i, work)}
            onDropCourse={(from, code) => move(from, code, i)}
            onFix={(code) => void fix(i, code)}
            onRemoveTerm={removeLastTerm}
          />
        ))}

        <button
          type="button"
          onClick={addTerm}
          className="flex min-h-[120px] items-center justify-center gap-2 rounded-3xl border border-dashed border-border-strong text-[13.5px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
        >
          <Plus size={15} aria-hidden /> Add a term
        </button>
      </div>

      <p className="max-w-3xl text-[12px] leading-relaxed text-subtle">
        This is your own sketch. It does not register you for anything, and it cannot tell which term a course will be offered in, because
        Concordia publishes its schedule one term at a time. Prerequisites are read from the calendar; where the wording is something we
        cannot check (permission, an equivalent course), the course is marked with a question mark instead of a verdict.
      </p>
    </div>
  )
}

function Chip({ icon: Icon, n, label }: { icon: typeof Plus; n: number; label: string }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.12] px-3 py-1.5 backdrop-blur-md">
      <Icon size={13} className="text-white/70" aria-hidden />
      <span className="font-semibold tabular-nums">{n}</span>
      <span className="text-white/75">{label}</span>
    </li>
  )
}
