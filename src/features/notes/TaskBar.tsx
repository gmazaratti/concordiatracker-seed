import { Check, ListChecks, X } from 'lucide-react'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { cn } from '@/lib/cn'
import type { CalendarTask } from '@/data/types'

/**
 * The strip above a task's page: done, when it is due, and a way to turn it
 * back into a plain note. The task is the same row Today and the calendar
 * show, so ticking it here ticks it there.
 */
export function TaskBar({ task, onToggle, onDue, onRemove }: {
  task: CalendarTask
  onToggle: () => void
  onDue: (iso: string) => void
  onRemove: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-success/[0.07] px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
        <ListChecks size={15} className="text-success" aria-hidden />
        Task
      </span>
      <button type="button" onClick={onToggle} aria-pressed={task.done}
        className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors duration-150',
          task.done ? 'border-transparent bg-success text-accent-contrast' : 'border-border text-fg hover:bg-surface-2')}>
        <Check size={14} strokeWidth={3} aria-hidden />
        {task.done ? 'Done' : 'Mark done'}
      </button>
      <div className="w-56">
        <DateTimePicker value={task.due || null} onChange={(iso) => iso && onDue(iso)} ariaLabel="When it is due" />
      </div>
      <span className="text-[12px] text-subtle">Shows on Today and in your calendar.</span>
      <button type="button" onClick={onRemove}
        className="ml-auto inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
        <X size={14} aria-hidden />
        Make it a plain note
      </button>
    </div>
  )
}
