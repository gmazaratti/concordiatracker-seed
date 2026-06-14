import { Check } from 'lucide-react'
import type { Assessment, AssessmentKind, Course } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'

const KIND_LABEL: Record<AssessmentKind, string> = {
  assignment: 'Assignment',
  quiz: 'Quiz',
  midterm: 'Midterm',
  final: 'Final',
  lab: 'Lab',
  reading: 'Reading',
  project: 'Project',
}

/** Due labels lean on color only as reinforcement — the text says it too. */
function dueTone(due: string, done: boolean): string {
  if (done) return 'text-subtle line-through'
  const days = daysUntil(due)
  if (days < 0) return 'text-danger'
  if (days === 0) return 'text-warning'
  return 'text-muted'
}

export function DueRow({
  assessment,
  course,
  done,
  onToggle,
}: {
  assessment: Assessment
  course: Course | undefined
  done: boolean
  onToggle: () => void
}) {
  const heavy = assessment.kind === 'midterm' || assessment.kind === 'final'
  return (
    <li className="flex items-start gap-3 px-3 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={done}
        aria-label={`Mark "${assessment.title}" ${done ? 'not done' : 'done'}`}
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
          done
            ? 'border-success bg-success text-accent-contrast'
            : 'border-border-strong text-transparent hover:border-accent hover:text-subtle',
        )}
      >
        <Check size={12} strokeWidth={3} className={done ? 'ct-animate-pop' : ''} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
            {course?.code ?? '—'}
          </span>
          <span
            className={cn(
              'truncate text-[14px] text-fg',
              heavy && 'font-medium',
              done && 'text-subtle line-through',
            )}
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
          dueTone(assessment.due, done),
        )}
      >
        {relativeDueLabel(assessment.due)}
      </span>
    </li>
  )
}
