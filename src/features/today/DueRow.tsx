import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Check, CircleDashed, Hourglass, Pencil, Trash2 } from 'lucide-react'
import { PendingSyncMark } from '@/components/PendingSyncMark'
import type { Assessment, AssessmentStatus, Course } from '@/data/types'
import type { TodayPrefs } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { SwipeRow, type SwipeAction } from '@/components/SwipeRow'
import { KIND_LABEL } from '@/lib/assessment'
import { CourseMark } from '@/components/CourseMark'
import { cn } from '@/lib/cn'
import { useT } from '@/i18n/i18n'
import { DueLabel } from './DueLabel'

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
  const t = useT()
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
  const unverified = assessment.provenance.status === 'unverified'

  const menuItems: MenuItem[] = [
    {
      id: 'edit',
      label: t('today.edit'),
      icon: Pencil,
      onSelect: () => openAssessment(assessment.id),
    },
    {
      id: 'awaiting',
      label: t('today.submitted'),
      icon: Hourglass,
      onSelect: () => onResolve('awaiting-grade'),
    },
    {
      id: 'open',
      label: t('today.openInCourse'),
      icon: ArrowUpRight,
      onSelect: () =>
        navigate(`/app/courses/${assessment.courseId}`, {
          state: { focus: assessment.id },
        }),
    },
    {
      id: 'delete',
      label: t('today.delete'),
      icon: Trash2,
      danger: true,
      separated: true,
      onSelect: onDelete,
    },
  ]

  /*
   * THE SWIPE ACTIONS ARE THE MENU'S ACTIONS, from the same array.
   *
   * Two lists would drift the first time one of them gained an entry, and a
   * gesture that does something the visible menu does not offer is a gesture
   * nobody can discover or verify.
   */
  // The tray fits three; "submitted" stays a menu-only action so the swipe
  // keeps its three (edit, open, delete) at full size.
  const swipeActions: SwipeAction[] = menuItems.filter((m) => m.id !== 'awaiting').map((m) => ({
    id: m.id,
    label: m.id === 'open' ? t('today.openShort') : m.label,
    icon: m.icon!,
    onSelect: m.onSelect,
    danger: m.danger,
  }))

  return (
    <li
      className={cn(
        'group relative',
        resolving && 'ct-animate-complete pointer-events-none',
      )}
      onAnimationEnd={resolving ? handleAnimationEnd : undefined}
    >
      <SwipeRow
        disabled={resolving}
        onSwipeRight={markDone}
        rightIcon={Check}
        rightLabel={t('today.markDone')}
        actions={swipeActions}
      >
      <div className={cn('flex items-start gap-3 px-3', compact ? 'py-1.5' : 'py-2.5')}>
        <button
          type="button"
          onClick={markDone}
          disabled={resolving}
          data-coach="mark-done"
          title={t('today.markDone')}
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
          title={t('today.editDetails')}
          className="-my-1 flex min-w-0 flex-1 items-start gap-3 rounded-md py-1 text-left transition-colors duration-150 hover:bg-surface-2/40"
        >
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 break-words text-[14px] leading-snug font-medium text-fg" title={assessment.title || undefined}>{assessment.title || <span className="text-subtle italic">Untitled</span>}</span>
            <span
              className={cn(
                'flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-subtle',
                compact ? 'mt-0.5' : 'mt-1',
              )}
            >
              {course && (
                <span className="inline-flex items-center gap-1.5">
                  <CourseMark course={course} icons={prefs.courseIcons ?? true} />
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
                    title={t('today.unverifiedDate')}
                  >
                    <CircleDashed size={12} aria-hidden />
                    <span className="sr-only">unverified date</span>
                  </span>
                )
              )}
              <PendingSyncMark table="assignments" id={assessment.id} />
            </span>
          </span>

          <DueLabel due={assessment.due} />
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
      </SwipeRow>
    </li>
  )
}
