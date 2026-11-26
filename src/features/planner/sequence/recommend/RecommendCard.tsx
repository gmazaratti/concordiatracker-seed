import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Loader2, Plus, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { Segmented } from '@/features/settings/controls'
import { useUiState } from '@/app/providers/ui-state'
import { autoPlace, planKey, type CoursePlan, type PlanCourse } from '@/lib/course-plan'
import { cn } from '@/lib/cn'
import { ChooseList } from './ChooseList'
import { INTERESTS } from './subjects'
import { DEFAULT_PREFS, usePool, type PlanPrefs, type PoolItem } from './usePool'

type Base = { completed: Set<string>; inProgress: Set<string>; credits: number; inProgressCredits?: number }

/** "Pick for me" stays a suggestion, not a catalogue. */
const AUTO_ELECTIVES = 6
const AUTO_PER_INTEREST = 2

function autoPicks(pool: PoolItem[]): PoolItem[] {
  const perSubject = new Map<string, number>()
  let electives = 0
  return pool.filter((p) => {
    if (p.reason === 'required') return true
    if (p.reason === 'elective') return electives++ < AUTO_ELECTIVES
    const n = perSubject.get(p.subject) ?? 0
    perSubject.set(p.subject, n + 1)
    return n < AUTO_PER_INTEREST
  })
}

/**
 * Recommend, two ways.
 *
 * "Pick for me" lays out a plan from your programme's requirements, the areas
 * you said you are into, and how many credits you want per term. "Let me
 * choose" shows the same pool as a list you tick. Either way nothing is added
 * until you press the button, and every course says why it is there.
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
  const { uiState, patchUiState } = useUiState()
  const saved = uiState.planPrefs
  const prefs: PlanPrefs = useMemo(() => ({ ...DEFAULT_PREFS, ...saved }), [saved])
  const max = prefs.max
  const setPrefs = (patch: Partial<PlanPrefs>) => patchUiState({ planPrefs: { ...prefs, ...patch } })
  const [mode, setMode] = useState<'auto' | 'choose'>('auto')

  const taken = useMemo(() => [...base.completed, ...base.inProgress], [base])
  const { program, pool, prereqs } = usePool(taken, prefs)

  const picks = useMemo(() => (pool ? autoPicks(pool) : []), [pool])
  const laid = useMemo(() => autoPlace(plan, picks, base, prereqs, max), [plan, picks, base, prereqs, max])
  const why = useMemo(() => new Map((pool ?? []).map((p) => [planKey(p.code), p.because])), [pool])

  /** One tap: into it. Second tap: not for me. Third: no opinion. */
  const cycle = (subject: string) => {
    const like = prefs.like.filter((s) => s !== subject)
    const avoid = prefs.avoid.filter((s) => s !== subject)
    if (prefs.like.includes(subject)) setPrefs({ like, avoid: [...avoid, subject] })
    else if (prefs.avoid.includes(subject)) setPrefs({ like, avoid })
    else setPrefs({ like: [...like, subject], avoid })
  }

  const byTerm = plan.terms.map((t, i) => ({ term: t.term, index: i, rows: laid.placed.filter((p) => p.index === i) })).filter((g) => g.rows.length > 0)

  return (
    <section className="ct-res-in rounded-3xl border border-accent/40 bg-surface p-4 sm:p-5">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] font-semibold text-fg">Recommended courses</h3>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-subtle">
            {program ? (
              `From the requirements of ${program.name} and what you are into.`
            ) : (
              <>
                From what you are into. For your degree&rsquo;s requirements,{' '}
                <Link to="/app/planner?tab=program" className="font-medium text-accent hover:underline">
                  pick your programme
                </Link>
                .
              </>
            )}
          </p>
        </div>
        <Segmented
          ariaLabel="How to recommend"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'auto', label: 'Pick for me' },
            { value: 'choose', label: 'Let me choose' },
          ]}
        />
        <button type="button" onClick={onClose} aria-label="Close recommendations" className="grid size-8 shrink-0 place-items-center rounded-full text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
          <X size={16} aria-hidden />
        </button>
      </header>

      <div className="mt-4 rounded-2xl bg-canvas p-3.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-[12px] font-semibold tracking-wide text-subtle uppercase">What are you into?</p>
          <p className="text-[11.5px] text-subtle">Tap once for into it, twice for not for me.</p>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-subtle">Credits a term</span>
            <div className="w-24">
              <Select
                size="sm"
                value={String(prefs.max)}
                onChange={(v) => setPrefs({ max: Number(v) })}
                options={['9', '12', '15', '18'].map((v) => ({ value: v, label: `Up to ${v}` }))}
                ariaLabel="Most credits in one term"
              />
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {INTERESTS.map((i) => {
            const liked = prefs.like.includes(i.subject)
            const avoided = prefs.avoid.includes(i.subject)
            return (
              <button
                key={i.subject}
                type="button"
                onClick={() => cycle(i.subject)}
                aria-label={`${i.label}: ${liked ? 'into it' : avoided ? 'not for me' : 'no opinion'}`}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                  liked && 'border-accent bg-accent text-accent-contrast',
                  avoided && 'border-danger/50 text-subtle line-through',
                  !liked && !avoided && 'border-border text-muted hover:border-border-strong hover:text-fg',
                )}
              >
                {liked && <ThumbsUp size={11} aria-hidden />}
                {avoided && <ThumbsDown size={11} aria-hidden className="text-danger" />}
                {i.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4">
        {pool === null ? (
          <p className="flex items-center gap-2 text-[13px] text-subtle">
            <Loader2 size={13} className="animate-spin" aria-hidden /> Working out what fits
          </p>
        ) : pool.length === 0 ? (
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <Check size={14} className="text-success" aria-hidden />
            {program
              ? 'Everything your programme names is finished, in progress or planned. Tap an area above for more ideas.'
              : 'Tap an area above to get suggestions.'}
          </p>
        ) : mode === 'choose' ? (
          <ChooseList plan={plan} base={base} pool={pool} prereqs={prereqs} max={prefs.max} onAddAll={onAddAll} />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-[12.5px] text-subtle">
                {laid.placed.length} courses over {byTerm.length} {byTerm.length === 1 ? 'term' : 'terms'}, each after its prerequisites.
              </p>
              {laid.placed.length > 0 && (
                <button
                  type="button"
                  onClick={() => onAddAll(laid.placed)}
                  className="shrink-0 rounded-full bg-accent px-4 py-2 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                >
                  Use this plan
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {byTerm.map((g) => (
                <div key={g.term} className="min-w-0">
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
                          <p className="mt-0.5 text-[11.5px] leading-snug text-muted">{why.get(planKey(course.code))}</p>
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
                Not placed: {laid.left.map((c) => c.code).join(', ')}. Either a prerequisite is not in your plan yet, or the terms are full.
                Add a term and it will pick up from there.
              </p>
            )}
          </>
        )}
        <p className="mt-3 text-[11.5px] leading-relaxed text-subtle">
          Work terms are skipped. Elective rules written as prose in the calendar are not read, so check that a course counts before you
          rely on it.
        </p>
      </div>
    </section>
  )
}
