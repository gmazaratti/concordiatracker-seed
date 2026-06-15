import { useRef, useState } from 'react'
import { Check, MoreHorizontal } from 'lucide-react'
import type { Assessment, AssessmentStatus, Course } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { QUICK_STATUSES, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'

/** Due labels lean on color only as reinforcement — the text says it too. */
function dueTone(due: string): string {
  const days = daysUntil(due)
  if (days < 0) return 'text-danger'
  if (days === 0) return 'text-warning'
  return 'text-muted'
}

/** An active (still-open) item. The round check is the fast path to "done"; the
 * overflow control reveals the other quick statuses (late / missed). Picking any
 * one plays a brief reward, then `onResolve` lifts the row into Completed today. */
export function DueRow({
  assessment,
  course,
  onResolve,
}: {
  assessment: Assessment
  course: Course | undefined
  onResolve: (status: AssessmentStatus) => void
}) {
  const [resolving, setResolving] = useState<AssessmentStatus | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const fired = useRef(false)
  const heavy = assessment.kind === 'midterm' || assessment.kind === 'final'

  function pick(status: AssessmentStatus) {
    if (resolving) return
    setMenuOpen(false)
    setResolving(status)
  }

  function handleAnimationEnd() {
    if (!resolving || fired.current) return
    fired.current = true
    onResolve(resolving)
  }

  const tone = resolving ? STATUS_META[resolving] : null

  return (
    <li
      className={cn(
        'group relative px-3 py-3',
        resolving && 'ct-animate-complete pointer-events-none',
      )}
      onAnimationEnd={resolving ? handleAnimationEnd : undefined}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => pick('done')}
          disabled={!!resolving}
          title="Mark done"
          aria-label={`Mark "${assessment.title}" done`}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
            resolving
              ? cn('border-transparent text-accent-contrast', tone?.dot)
              : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
          )}
        >
          <Check
            size={12}
            strokeWidth={3}
            className={resolving ? 'ct-animate-check' : ''}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {course?.code ?? '—'}
            </span>
            <span
              className={cn('truncate text-[14px] text-fg', heavy && 'font-medium')}
            >
              {assessment.title}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-subtle">
            <span>
              {KIND_LABEL[assessment.kind]} · {assessment.weight}% of grade
            </span>
            <ProvenanceBadge provenance={assessment.provenance} />
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 pt-0.5 text-[12px] font-medium',
            dueTone(assessment.due),
          )}
        >
          {relativeDueLabel(assessment.due)}
        </span>

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          disabled={!!resolving}
          aria-expanded={menuOpen}
          aria-label={`Set status for "${assessment.title}"`}
          title="Set status"
          className={cn(
            'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100',
            'opacity-60 group-hover:opacity-100',
            menuOpen && 'bg-surface-2 text-fg opacity-100',
          )}
        >
          <MoreHorizontal size={16} />
        </button>
      </div>

      {menuOpen && !resolving && (
        <div className="ct-animate-fade mt-2 flex items-center gap-1.5 pl-8">
          <span className="text-[11px] text-subtle">Mark as</span>
          {QUICK_STATUSES.map((s) => {
            const meta = STATUS_META[s]
            return (
              <button
                key={s}
                type="button"
                onClick={() => pick(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted transition-colors duration-150 hover:border-border-strong hover:bg-surface-2 hover:text-fg"
              >
                <span
                  className={cn('size-1.5 rounded-full', meta.dot)}
                  aria-hidden
                />
                {meta.label}
              </button>
            )
          })}
        </div>
      )}
    </li>
  )
}
