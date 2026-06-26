import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, CircleDashed, Pencil, Trash2 } from 'lucide-react'
import type { Assessment, AssessmentStatus, Course } from '@/data/types'
import type { TodayPrefs } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { KIND_LABEL } from '@/lib/assessment'
import { courseColor } from '@/lib/course-color'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'

/** Due labels lean on color only as urgency reinforcement — the text says it too,
 * and everything that isn't urgent stays neutral so the row reads calm. */
function dueTone(due: string): string {
  const days = daysUntil(due)
  if (days < 0) return 'text-danger'
  if (days === 0) return 'text-warning'
  return 'text-fg'
}

/** A calm active row: title + course + due (primary). The course reads as a small
 * identity DOT + plain code (no full-color pill); saturated color is reserved for
 * urgency. Provenance is intentionally off here (it belongs on Courses + the
 * detail editor) — the one exception is a quiet "unverified" marker so a shaky
 * date still whispers caution. The round check is the fast path to done; the "…"
 * menu holds enter-grade / open-in-course / delete so the surface stays clean. */
export function DueRow({
  assessment,
  course,
  prefs,
  onResolve,
  onDelete,
}: {
  assessment: Assessment
  course: Course | undefined
  prefs: TodayPrefs
  onResolve: (status: AssessmentStatus) => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const { openAssessment } = useQuickActions()
  const [resolving, setResolving] = useState(false)
  const fired = useRef(false)

  function markDone() {
    if (resolving) return
    setResolving(true)
  }

  function handleAnimationEnd() {
    if (!resolving || fired.current) return
    fired.current = true
    onResolve('done')
  }

  const compact = prefs.density === 'compact'
  const hex = course ? courseColor(course.color).hex : undefined
  const unverified = assessment.provenance.status === 'unverified'

  const menuItems: MenuItem[] = [
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      onSelect: () => openAssessment(assessment.id),
    },
    {
      id: 'open',
      label: 'Open in course',
      icon: ArrowUpRight,
      onSelect: () =>
        navigate(`/app/courses/${assessment.courseId}`, {
          state: { focus: assessment.id },
        }),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      danger: true,
      separated: true,
      onSelect: onDelete,
    },
  ]

  return (
    <li
      className={cn(
        'group relative px-3',
        compact ? 'py-1.5' : 'py-2.5',
        resolving && 'ct-animate-complete pointer-events-none',
      )}
      onAnimationEnd={resolving ? handleAnimationEnd : undefined}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={markDone}
          disabled={resolving}
          data-coach="mark-done"
          title="Mark done"
          aria-label={`Mark "${assessment.title}" done`}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150 active:scale-90',
            resolving
              ? 'border-transparent bg-success text-accent-contrast'
              : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
          )}
        >
          <Check size={12} strokeWidth={3} className={resolving ? 'ct-animate-check' : ''} />
        </button>

        {/* The whole title/meta/due area is the tap target to edit details. */}
        <button
          type="button"
          onClick={() => openAssessment(assessment.id)}
          title="Edit details"
          className="-my-1 flex min-w-0 flex-1 items-start gap-3 rounded-md py-1 text-left transition-colors duration-150 hover:bg-surface-2/40"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium text-fg">{assessment.title}</span>
            <span
              className={cn(
                'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-subtle',
                compact ? 'mt-0.5' : 'mt-1',
              )}
            >
              {course && (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: hex }}
                    aria-hidden
                  />
                  <span>{course.code}</span>
                </span>
              )}
              <span>
                {KIND_LABEL[assessment.kind]}
                {prefs.showWeight && ` · ${assessment.weight}%`}
              </span>
              {prefs.showProvenance ? (
                <ProvenanceBadge provenance={assessment.provenance} tone="quiet" />
              ) : (
                unverified && (
                  <span
                    className="inline-flex items-center gap-1 text-subtle/80"
                    title="Unverified date — not yet corroborated"
                  >
                    <CircleDashed size={12} aria-hidden />
                    <span className="sr-only">unverified date</span>
                  </span>
                )
              )}
            </span>
          </span>

          <span
            className={cn('shrink-0 pt-px text-[13px] font-semibold', dueTone(assessment.due))}
          >
            {relativeDueLabel(assessment.due)}
          </span>
        </button>

        <DropdownMenu
          ariaLabel={`More actions for "${assessment.title}"`}
          disabled={resolving}
          items={menuItems}
          triggerClassName={cn(
            'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
            'opacity-60 group-hover:opacity-100 focus-visible:opacity-100',
            'data-[state=open]:bg-surface-2 data-[state=open]:text-fg data-[state=open]:opacity-100',
          )}
        />
      </div>
    </li>
  )
}
