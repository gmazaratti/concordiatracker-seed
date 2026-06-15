import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, MoreHorizontal } from 'lucide-react'
import type { Assessment, AssessmentStatus, Course } from '@/data/types'
import { useQuickActions } from '@/app/providers/quick-actions'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { CourseChip } from '@/components/CourseChip'
import { isOpen, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'
import { DueRowMenu } from './DueRowMenu'

/** Due labels lean on color only as urgency reinforcement — the text says it too,
 * and everything that isn't urgent stays neutral so the row reads calm. */
function dueTone(due: string): string {
  const days = daysUntil(due)
  if (days < 0) return 'text-danger'
  if (days === 0) return 'text-warning'
  return 'text-fg'
}

/** An active (still-open) item. The round check is the fast path to "done"; the
 * "…" menu holds everything else (other statuses, the full editor, the course
 * link) so the row surface stays a clean title + due line. A terminal status
 * plays a brief reward, then `onResolve` lifts the row into Completed today; an
 * open status (in-progress / extension) just annotates it in place. */
export function DueRow({
  assessment,
  course,
  onResolve,
  onSetStatus,
}: {
  assessment: Assessment
  course: Course | undefined
  onResolve: (status: AssessmentStatus) => void
  onSetStatus: (status: AssessmentStatus) => void
}) {
  const navigate = useNavigate()
  const { openAssessment } = useQuickActions()
  const [resolving, setResolving] = useState<AssessmentStatus | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const fired = useRef(false)

  function pick(status: AssessmentStatus) {
    if (resolving) return
    setMenuOpen(false)
    if (isOpen(status)) {
      onSetStatus(status)
    } else {
      setResolving(status)
    }
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
        'group relative px-3 py-2.5',
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
          <p className="truncate text-[14px] font-medium text-fg">
            {assessment.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
            {course && <CourseChip code={course.code} color={course.color} />}
            <span>
              {KIND_LABEL[assessment.kind]} · {assessment.weight}%
            </span>
            <ProvenanceBadge provenance={assessment.provenance} tone="quiet" />
          </div>
        </div>

        <span
          className={cn(
            'shrink-0 pt-px text-[13px] font-semibold',
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
          aria-label={`More actions for "${assessment.title}"`}
          title="More actions"
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
        <DueRowMenu
          onPick={pick}
          onEdit={() => {
            setMenuOpen(false)
            openAssessment(assessment.id)
          }}
          onOpenCourse={() => {
            setMenuOpen(false)
            navigate(`/app/courses/${assessment.courseId}`)
          }}
        />
      )}
    </li>
  )
}
