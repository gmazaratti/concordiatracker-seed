import { useState } from 'react'
import { Check, ChevronDown, GraduationCap, ListChecks } from 'lucide-react'
import type { CalendarTask } from '@/data/types'
import type { TodayPrefs } from '@/app/providers/app-data'
import { relativeDueLabel, daysUntil } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * A todo on Today — a Moodle deadline, or one you wrote yourself.
 *
 * ONE component for both, because they are the same row with a different
 * provenance line, and two would drift. What differs is only what the second
 * line says and whether there is a checklist under it.
 *
 * Only the ones that are NOT already on screen as an assessment reach here —
 * things a professor posted that no syllabus lists, like "Join a Group (Due
 * date)". So this row deliberately reads as a sibling of a due row, not a
 * copy of one: same shape, same date language, no weight and no grade,
 * because Moodle does not tell us either and inventing them would put a
 * fictional number into the grade breakdown.
 *
 * Ticking it toggles the underlying TODO. That is the whole reason this is a
 * separate component rather than a synthetic Assessment: a fake assessment
 * would send an id to `setStatus` that the assignments table has never heard
 * of, and a tick that silently does nothing is worse than no tick.
 *
 * The source is labelled on every row. A date we did not get from the student
 * or from a course outline should say where it came from — the same rule the
 * provenance badges follow.
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
  // COLLAPSED BY DEFAULT, and that is the whole compromise. A five-line
  // checklist printed under every row would turn Today back into the wall of
  // detail the whole screen was cut down from; but a prep list you have to
  // open another tab to tick is not a prep list. One tap, no navigation, and
  // nothing added at rest.
  const [open, setOpen] = useState(false)
  const steps = task.steps ?? []
  const stepsDone = steps.filter((s) => s.done).length
  const moodle = task.source === 'moodle'
  const late = daysUntil(task.due) < 0 && !task.done
  // Moodle's note leads with the course short name ("FINA-210-2262-B · …"),
  // which is the only thing here that says which class this belongs to.
  const course = task.note?.split('·')[0]?.trim()

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4',
        prefs.density === 'compact' ? 'py-1.5' : 'py-2.5',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={task.done ? `Mark "${task.title}" not done` : `Mark "${task.title}" done`}
        title={task.done ? 'Mark not done' : 'Mark done'}
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
          task.done
            ? 'border-transparent bg-success text-accent-contrast'
            : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
        )}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('text-[14px] text-fg', task.done && 'text-muted line-through')}>
          {task.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-subtle">
          {moodle ? (
            <GraduationCap size={12} className="shrink-0" aria-hidden />
          ) : (
            <ListChecks size={12} className="shrink-0" aria-hidden />
          )}
          <span>{moodle ? 'Moodle' : 'Task'}</span>
          {moodle && course && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{course}</span>
            </>
          )}
          {steps.length > 0 && (
            <>
              <span aria-hidden>·</span>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1 rounded text-subtle transition-colors duration-150 hover:text-fg"
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
                  <span
                    className={cn('text-[12.5px] text-muted', s.done && 'text-subtle line-through')}
                  >
                    {s.text}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <span
        className={cn(
          'mt-0.5 shrink-0 text-[12.5px] tabular-nums',
          late ? 'font-medium text-danger' : 'text-fg',
        )}
      >
        {relativeDueLabel(task.due)}
      </span>
    </div>
  )
}
