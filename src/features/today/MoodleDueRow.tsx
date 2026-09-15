import { Check, GraduationCap } from 'lucide-react'
import type { CalendarTask } from '@/data/types'
import type { TodayPrefs } from '@/app/providers/app-data'
import { relativeDueLabel, daysUntil } from '@/lib/date'
import { cn } from '@/lib/cn'

/**
 * A Moodle deadline on Today.
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
export function MoodleDueRow({
  task,
  prefs,
  onToggle,
}: {
  task: CalendarTask
  prefs: TodayPrefs
  onToggle: () => void
}) {
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
          <GraduationCap size={12} className="shrink-0" aria-hidden />
          <span>Moodle</span>
          {course && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{course}</span>
            </>
          )}
        </p>
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
