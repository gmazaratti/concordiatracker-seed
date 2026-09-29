import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Check, ChevronDown, GraduationCap, ListChecks, RotateCcw, Trash2 } from 'lucide-react'
import type { CalendarTask } from '@/data/types'
import type { TodayPrefs } from '@/app/providers/app-data'
import { useAppData } from '@/app/providers/app-data'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/cn'
import { DueLabel } from './DueLabel'

/**
 * A todo on Today — a Moodle deadline, or one you wrote yourself.
 *
 * ONE component for both, because they are the same row with a different
 * provenance line, and two would drift. What differs is only what the second
 * line says and whether there is a checklist under it.
 *
 * Only the ones that are NOT already on screen as an assessment reach here —
 * things a professor posted that no syllabus lists, like "Join a Group (Due
 * date)". No weight and no grade, because Moodle does not tell us either and
 * inventing them would put a fictional number into the grade breakdown.
 *
 * SAME SHAPE AS THE ASSESSMENT ROW (DueRow), deliberately and exactly: the same
 * side padding, the same check, the content and due date in one inner row, the
 * shared `DueLabel`, and a ⋯ in the same last slot. The row used to have its
 * own padding, a lighter due date and no ⋯, so its dates sat 36px to the right
 * of every assessment's and read as a different kind of thing.
 *
 * Ticking it toggles the underlying TODO (a synthetic assessment would send
 * `setStatus` an id the assignments table has never heard of). The source is
 * labelled on every row, the same rule the provenance badges follow.
 */
export function TaskDueRow({
  task,
  prefs,
  onToggle,
  onToggleStep,
}: {
  task: CalendarTask
  prefs: TodayPrefs
  onToggle: () => void
  onToggleStep?: (index: number) => void
}) {
  const navigate = useNavigate()
  const { removeTask } = useAppData()
  // COLLAPSED BY DEFAULT: a checklist printed under every row would turn Today
  // back into a wall; one tap, no navigation, nothing added at rest.
  const [open, setOpen] = useState(false)
  const steps = task.steps ?? []
  const stepsDone = steps.filter((s) => s.done).length
  const moodle = task.source === 'moodle'
  const compact = prefs.density === 'compact'
  // Moodle's note leads with the course short name ("FINA-210-2262-B · …"),
  // which is the only thing here that says which class this belongs to.
  const course = task.note?.split('·')[0]?.trim()

  const menuItems: MenuItem[] = [
    {
      id: 'toggle',
      label: task.done ? 'Mark not done' : 'Mark done',
      icon: task.done ? RotateCcw : Check,
      onSelect: onToggle,
    },
    {
      id: 'calendar',
      label: 'Open in calendar',
      icon: CalendarDays,
      onSelect: () => navigate('/app/calendar'),
    },
    // A Moodle item is not offered Delete: the next nightly sync would put it
    // straight back, and a delete that undoes itself is worse than none.
    ...(moodle
      ? []
      : [
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            danger: true,
            separated: true,
            onSelect: () => removeTask(task.id),
          } satisfies MenuItem,
        ]),
  ]

  return (
    <div className={cn('group flex items-start gap-3 px-3', compact ? 'py-1.5' : 'py-2.5')}>
      <button
        type="button"
        onClick={onToggle}
        aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        title={task.done ? 'Mark not done' : 'Mark done'}
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150 active:scale-90',
          task.done
            ? 'border-transparent bg-success text-accent-contrast'
            : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
        )}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      {/* Content and due date share one inner row, exactly as on DueRow. */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'line-clamp-2 break-words text-[14px] leading-snug font-medium text-fg',
              task.done && 'text-muted line-through',
            )}
            title={task.title}
          >
            {task.title}
          </p>
          <p
            className={cn(
              'flex min-w-0 items-center gap-x-1.5 text-[11px] text-subtle',
              compact ? 'mt-0.5' : 'mt-1',
            )}
          >
            {moodle ? (
              <GraduationCap size={12} className="shrink-0" aria-hidden />
            ) : (
              <ListChecks size={12} className="shrink-0" aria-hidden />
            )}
            <span className="shrink-0">{moodle ? 'Moodle' : 'Task'}</span>
            {moodle && course && (
              <>
                <span aria-hidden className="shrink-0">·</span>
                <span className="min-w-0 truncate">{course}</span>
              </>
            )}
            {steps.length > 0 && (
              <>
                <span aria-hidden className="shrink-0">·</span>
                <button
                  type="button"
                  onClick={() => setOpen((v) => !v)}
                  aria-expanded={open}
                  className="inline-flex shrink-0 items-center gap-1 rounded text-subtle transition-colors duration-150 hover:text-fg"
                >
                  {stepsDone} of {steps.length} done
                  <ChevronDown
                    size={12}
                    className={cn('transition-transform duration-150', open && 'rotate-180')}
                    aria-hidden
                  />
                </button>
              </>
            )}
          </p>

          {open && steps.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-1">
              {steps.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onToggleStep?.(i)}
                    aria-pressed={s.done}
                    className="flex w-full items-start gap-2 rounded-md py-0.5 text-left transition-colors duration-150 hover:bg-surface-2/60"
                  >
                    <span
                      className={cn(
                        'mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-[4px] border transition-colors duration-150',
                        s.done
                          ? 'border-transparent bg-success text-accent-contrast'
                          : 'border-border-strong text-transparent',
                      )}
                    >
                      <Check size={10} strokeWidth={3} aria-hidden />
                    </span>
                    <span className={cn('text-[12.5px] text-muted', s.done && 'text-subtle line-through')}>
                      {s.text}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DueLabel due={task.due} done={task.done} />
      </div>

      <DropdownMenu
        ariaLabel={`More actions for "${task.title}"`}
        items={menuItems}
        triggerClassName={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
          'opacity-60 group-hover:opacity-100 focus-visible:opacity-100',
          'data-[state=open]:bg-surface-2 data-[state=open]:text-fg data-[state=open]:opacity-100',
        )}
      />
    </div>
  )
}
