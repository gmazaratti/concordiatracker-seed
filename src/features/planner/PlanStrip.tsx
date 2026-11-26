import { Route } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { termLabel } from '@/lib/course-sections'

/**
 * In the schedule builder: the courses your Course sequence has for the term
 * being built, one tap each to look up their sections. The plan says WHAT you
 * mean to take; the builder is where you choose which section.
 */
export function PlanStrip({ termCode, picked, onPick }: { termCode: string; picked: Set<string>; onPick: (code: string) => void }) {
  const { uiState } = useUiState()
  const name = termLabel(termCode)
  const courses = uiState.coursePlan?.terms.find((t) => t.term === name)?.courses ?? []
  if (courses.length === 0) return null
  return (
    <div className="mb-3 rounded-xl border border-border bg-canvas px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11.5px] font-semibold tracking-wide text-subtle uppercase">
        <Route size={12} aria-hidden /> From your course sequence
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {courses.map((c) => {
          const done = picked.has(c.code.replace(/\s+/g, '').toUpperCase())
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onPick(c.code)}
              title={done ? 'Already on your week' : `Find sections of ${c.code}`}
              className={
                done
                  ? 'rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent'
                  : 'rounded-full border border-border px-2.5 py-1 text-[12px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg'
              }
            >
              {c.code}
            </button>
          )
        })}
      </div>
    </div>
  )
}
