import { Check, Trash2 } from 'lucide-react'
import type { Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { CourseChip } from '@/components/CourseChip'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { KIND_LABEL } from '@/lib/assessment'
import { daysUntil } from '@/lib/date'
import { isOpen } from '@/lib/status'
import { cn } from '@/lib/cn'
import { ACADEMIC_META, type CalendarItem } from './calendar'

const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })

/** One detailed event row — the shared building block of the agenda and the day
 * detail modal. Assignments carry a done-check, course chip and full provenance,
 * and open the same detail popover used everywhere; personal tasks toggle + delete
 * inline; Concordia events are read-only with their layer's info-blue icon. */
export function ItemRow({
  item,
  course,
  closeBeforeOpen,
}: {
  item: CalendarItem
  course?: Course
  /** The day modal passes its close fn so opening an assessment doesn't stack. */
  closeBeforeOpen?: () => void
}) {
  const { setStatus, toggleTask, removeTask } = useAppData()
  const { openAssessment } = useQuickActions()

  if (item.kind === 'assessment') {
    const a = item.assessment
    const done = a.status === 'done'
    const overdue = isOpen(a.status) && daysUntil(a.due) < 0
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
          {overdue ? 'Overdue' : TIME.format(new Date(a.due))}
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
          {t.note && <p className="mt-0.5 text-[12px] text-subtle">{t.note}</p>}
          <p className="mt-0.5 text-[11px] text-subtle">Task · {TIME.format(new Date(t.due))}</p>
        </div>

        <button
          type="button"
          onClick={() => removeTask(t.id)}
          aria-label={`Delete "${t.title}"`}
          className="mt-0.5 shrink-0 rounded-md p-1 text-subtle opacity-0 transition-colors duration-150 group-hover:opacity-100 hover:bg-surface-2 hover:text-danger focus-visible:opacity-100"
        >
          <Trash2 size={14} aria-hidden />
        </button>
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
        <p className="mt-0.5 text-[11px] text-subtle">Concordia · {meta.label}</p>
      </div>
    </div>
  )
}
