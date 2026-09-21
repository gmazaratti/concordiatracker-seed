import { Check, CircleDashed, Pencil, Repeat, Trash2 } from 'lucide-react'
import type { CalendarTask, Course, TaskStep } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { CourseChip } from '@/components/CourseChip'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { KIND_LABEL } from '@/lib/assessment'
import { daysUntil, tbdLabel } from '@/lib/date'
import { isOpen } from '@/lib/status'
import { cn } from '@/lib/cn'
import { MovedNote } from './MovedNote'
import { ACADEMIC_META, type CalendarItem } from './calendar'
import { formatTime } from '@/lib/date'
import { useT } from '@/i18n/i18n'

const TIME = { format: (d: Date) => formatTime(d) }

/** One detailed event row — the shared building block of the agenda and the day
 * detail modal. Assignments carry a done-check, course chip and full provenance,
 * and open the same detail popover used everywhere; personal tasks toggle + delete
 * inline; Concordia events are read-only with their layer's info-blue icon. */
export function ItemRow({
  item,
  course,
  closeBeforeOpen,
  onEditTask,
}: {
  item: CalendarItem
  course?: Course
  /** The day modal passes its close fn so opening an assessment doesn't stack. */
  closeBeforeOpen?: () => void
  /** Offered only where there is somewhere for the form to go — the day modal
   *  swaps its own footer. Without it the pencil is not drawn, rather than
   *  drawn and dead. */
  onEditTask?: (task: CalendarTask) => void
}) {
  const t = useT()
  const { setStatus, toggleTask, removeTask, updateTask } = useAppData()
  const { openAssessment } = useQuickActions()

  if (item.kind === 'assessment') {
    const a = item.assessment
    const done = a.status === 'done'
    const overdue = isOpen(a.status) && !!a.due && daysUntil(a.due) < 0
    return (
      <div className="flex items-start gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => setStatus(a.id, done ? 'not-started' : 'done')}
          aria-label={done ? `Mark "${a.title}" not done` : `Mark "${a.title}" done`}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
            done
              ? 'border-transparent bg-success text-accent-contrast'
              : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
          )}
        >
          <Check size={12} strokeWidth={3} />
        </button>

        <button
          type="button"
          onClick={() => {
            closeBeforeOpen?.()
            openAssessment(a.id)
          }}
          className="min-w-0 flex-1 text-left"
        >
          <p className={cn('truncate text-[14px] font-medium text-fg', done && 'text-muted line-through')}>
            {a.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
            {course && <CourseChip code={course.code} color={course.color} />}
            <span>
              {KIND_LABEL[a.kind]} · {a.weight}%
            </span>
            <ProvenanceBadge provenance={a.provenance} />
          </div>
        </button>

        <span
          className={cn(
            'shrink-0 pt-0.5 text-[11px] font-medium tabular-nums',
            overdue ? 'text-danger' : 'text-subtle',
          )}
        >
          {overdue ? t('today.overdue') : a.due ? TIME.format(new Date(a.due)) : tbdLabel()}
        </span>
      </div>
    )
  }

  if (item.kind === 'task') {
    const t = item.task
    return (
      <div className="group flex items-start gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={() => toggleTask(t.id)}
          aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
            t.done
              ? 'border-transparent bg-success text-accent-contrast'
              : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
          )}
        >
          <Check size={12} strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[14px] font-medium text-fg', t.done && 'text-muted line-through')}>
            {t.title}
          </p>
          {t.note && (
            <p className="mt-0.5 text-[12px] leading-relaxed whitespace-pre-line text-subtle">
              {t.note}
            </p>
          )}
          {/* Ticked HERE rather than behind an edit screen. A checklist you
              have to open a form to cross a line off is not a checklist. */}
          {t.steps && t.steps.length > 0 && (
            <StepChecklist
              steps={t.steps}
              onToggle={(i) =>
                updateTask(t.id, {
                  steps: t.steps!.map((s, n) => (n === i ? { ...s, done: !s.done } : s)),
                })
              }
            />
          )}
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-subtle">
            <span>
              {t.source === 'moodle' ? 'Moodle' : 'Task'} · {TIME.format(new Date(t.due))}
            </span>
            {t.repeatGroup && (
              <span className="inline-flex items-center gap-1">
                <Repeat size={10} aria-hidden />
                repeats
              </span>
            )}
          </p>
          {t.movedFrom && <MovedNote id={t.id} from={t.movedFrom} to={t.due} />}
        </div>

        {/* A Moodle deadline is the professor's record, not yours — editing it
            here would only make your copy disagree with the next sync. */}
        {onEditTask && t.source !== 'moodle' && (
          <button
            type="button"
            onClick={() => onEditTask(t)}
            aria-label={`Edit "${t.title}"`}
            className="mt-0.5 shrink-0 rounded-md p-1 text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
          >
            <Pencil size={14} aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={() => removeTask(t.id)}
          aria-label={`Delete "${t.title}"`}
          className="mt-0.5 shrink-0 rounded-md p-1 text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 size={14} aria-hidden />
        </button>
      </div>
    )
  }

  if (item.kind === 'undated') {
    return (
      <div className="flex items-start gap-3 px-3 py-2.5">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-warning/15 text-warning">
          <CircleDashed size={12} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-fg">
            {item.items.length} {item.items.length === 1 ? 'item has' : 'items have'} no date yet
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-subtle">
            {item.items.map((a) => a.title).join(' · ')} — somewhere in{' '}
            {item.period.title.toLowerCase()}. Set the date once the registrar publishes it.
          </p>
        </div>
      </div>
    )
  }

  const e = item.event
  const meta = ACADEMIC_META[e.kind]
  const Icon = meta.icon
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-info/15 text-info">
        <Icon size={12} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-fg">{e.title}</p>
        <p className="mt-0.5 text-[11px] text-subtle">Concordia · {t(meta.labelKey)}</p>
      </div>
    </div>
  )
}


/** The task's own checklist, ticked in place. Progress is stated as a count
 *  rather than a bar: three of five is a fact, a bar is a decoration. */
function StepChecklist({
  steps,
  onToggle,
}: {
  steps: TaskStep[]
  onToggle: (index: number) => void
}) {
  const done = steps.filter((s) => s.done).length
  return (
    <div className="mt-1.5">
      <p className="mb-1 text-[11px] font-medium text-subtle">
        {done} of {steps.length} done
      </p>
      <ul className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onToggle(i)}
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
    </div>
  )
}
