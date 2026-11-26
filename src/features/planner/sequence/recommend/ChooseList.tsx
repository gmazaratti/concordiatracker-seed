import { useMemo, useState } from 'react'
import { Checkbox } from '@/components/ui/Checkbox'
import { autoPlace, missingPrereqs, planKey, type CoursePlan, type PlanCourse } from '@/lib/course-plan'
import type { Prereq } from '@/lib/prereq'
import { cn } from '@/lib/cn'
import type { PoolItem, PoolReason } from './usePool'

type Base = { completed: Set<string>; inProgress: Set<string>; credits: number; inProgressCredits?: number }
const GROUPS: { reason: PoolReason; title: string }[] = [
  { reason: 'required', title: 'Required by your programme' },
  { reason: 'elective', title: 'Counts toward an elective rule' },
  { reason: 'interest', title: 'From what you are into' },
]

/**
 * "Let me choose": the whole list, ticked by hand.
 *
 * Every tick re-lays the selection over the coming terms, so each chosen
 * course shows the term it would land in, and every course not yet chosen
 * says whether it still fits: one whose prerequisite is not finished, planned
 * or ticked is greyed with what it needs, and so is one there is no room for.
 */
export function ChooseList({
  plan,
  base,
  pool,
  prereqs,
  max,
  onAddAll,
}: {
  plan: CoursePlan
  base: Base
  pool: PoolItem[]
  prereqs: Map<string, Prereq>
  max: number
  onAddAll: (items: { index: number; course: PlanCourse }[]) => void
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const chosen = useMemo(() => pool.filter((p) => picked.has(planKey(p.code))), [pool, picked])
  const laid = useMemo(() => autoPlace(plan, chosen, base, prereqs, max), [plan, chosen, base, prereqs, max])
  const termOf = useMemo(() => new Map(laid.placed.map((p) => [planKey(p.course.code), plan.terms[p.index].term])), [laid, plan])

  /** For each course not ticked: would it still fit beside what is ticked? */
  const fits = useMemo(() => {
    const known = new Set<string>([...base.completed, ...base.inProgress, ...picked, ...plan.terms.flatMap((t) => t.courses.map((c) => planKey(c.code)))])
    const out = new Map<string, string>()
    for (const item of pool) {
      const k = planKey(item.code)
      if (picked.has(k)) continue
      const r = autoPlace(plan, [...chosen, item], base, prereqs, max)
      if (r.placed.some((p) => planKey(p.course.code) === k) && r.left.length === laid.left.length) continue
      const needs = missingPrereqs(item.code, prereqs, known)
      out.set(k, needs.length ? `Needs ${needs.join(', ')} first` : 'No term has room for it')
    }
    return out
  }, [pool, picked, chosen, plan, base, prereqs, max, laid])

  const toggle = (code: string) =>
    setPicked((s) => {
      const next = new Set(s)
      const k = planKey(code)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  return (
    <div>
      <div className="space-y-4">
        {GROUPS.map((g) => {
          const items = pool.filter((p) => p.reason === g.reason)
          if (items.length === 0) return null
          return (
            <div key={g.reason}>
              <p className="text-[12px] font-semibold tracking-wide text-subtle uppercase">{g.title}</p>
              <ul className="mt-1.5 grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const k = planKey(item.code)
                  const on = picked.has(k)
                  const blocked = fits.get(k)
                  const term = termOf.get(k)
                  return (
                    <li key={k} className={cn('min-w-0 rounded-xl bg-canvas px-3 py-2', blocked && 'opacity-55')}>
                      <Checkbox
                        checked={on}
                        onChange={() => (blocked && !on ? undefined : toggle(item.code))}
                        label={
                          <span className="block min-w-0">
                            <span className="block text-[13px] text-fg">
                              <span className="font-semibold">{item.code}</span>
                              <span className="ml-1.5 text-[11.5px] text-subtle tabular-nums">{item.credits} cr</span>
                            </span>
                            <span className="line-clamp-1 text-[12px] break-words text-subtle">{item.title}</span>
                            <span className={cn('mt-0.5 block text-[11.5px] leading-snug', on ? 'font-medium text-accent' : 'text-muted')}>
                              {on ? (term ? `Goes in ${term}` : 'Does not fit with the rest: untick something or add a term') : (blocked ?? item.because)}
                            </span>
                          </span>
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 border-t border-border bg-surface pt-3">
        <p className="min-w-0 flex-1 text-[12.5px] text-subtle">
          {picked.size === 0
            ? 'Tick the courses you want. Greyed ones do not fit yet.'
            : `${laid.placed.length} of ${picked.size} chosen fit, ${laid.placed.reduce((n, p) => n + p.course.credits, 0)} credits.`}
        </p>
        <button
          type="button"
          disabled={laid.placed.length === 0}
          onClick={() => {
            onAddAll(laid.placed)
            setPicked(new Set())
          }}
          className="shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-40"
        >
          Add {laid.placed.length || ''} to my plan
        </button>
      </div>
    </div>
  )
}
