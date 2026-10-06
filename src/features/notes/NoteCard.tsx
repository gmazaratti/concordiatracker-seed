import { Check, CalendarClock, FileText, Pin } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CalendarTask } from '@/data/types'
import { relativeDueLabel } from '@/lib/date'
import { noteDate } from './note-format'
import type { NoteMeta } from './types'

/** When the last right-click menu opened, shared by every card. */
let lastMenu = 0

/**
 * A note in a folder: a small sheet of paper, standing on a tinted desk, with
 * its title and first lines on it — so a grid of notes reads as documents
 * rather than as a list of boxes. A task wears a tick box and its due date.
 */
export function NoteCard({
  note,
  task,
  onToggleTask,
  dragging,
  onOpen,
  onContextMenu,
  dragProps,
}: {
  note: NoteMeta
  task?: CalendarTask
  onToggleTask?: (taskId: string) => void
  dragging?: boolean
  onOpen: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  dragProps?: React.HTMLAttributes<HTMLElement> & { draggable?: boolean }
}) {
  const lines = (note.excerpt || '').split('\n').map((l) => l.trim()).filter(Boolean)
  const title = note.title || (task ? 'Untitled task' : 'Untitled note')
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        // A ctrl-click on a Mac is a right-click, and the menu it opened must
        // not be followed by the note opening underneath it.
        if (e.ctrlKey || e.button !== 0 || Date.now() - lastMenu < 700) return
        onOpen()
      }}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      onContextMenu={(e) => {
        lastMenu = Date.now()
        onContextMenu?.(e)
      }}
      {...dragProps}
      className={cn(
        'group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left',
        'transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg focus-visible:outline-2 focus-visible:outline-accent',
        dragging && 'opacity-40',
      )}
    >
      <span className={cn('relative block h-28 overflow-hidden px-5 pt-4', task ? 'bg-success/10' : 'bg-accent-soft/60')}>
        <span className="relative block h-full rounded-t-lg border border-b-0 border-border bg-surface px-3 pt-2.5 shadow-sm transition-transform duration-200 group-hover:-translate-y-1">
          {/* The folded corner of a sheet of paper. */}
          <span aria-hidden className="absolute top-0 right-0 size-3.5 rounded-bl-[5px] border-b border-l border-border bg-surface-2" />
          <span className={cn('block truncate pr-4 text-[10.5px] font-semibold', note.title ? 'text-fg' : 'text-subtle')}>{title}</span>
          {lines.length ? (
            lines.slice(0, 4).map((l, i) => (
              <span key={i} className="mt-1 block truncate text-[9.5px] leading-[1.35] text-muted">{l}</span>
            ))
          ) : (
            <span className="mt-2 flex flex-col gap-1.5" aria-hidden>
              <span className="h-1 w-4/5 rounded-full bg-border" />
              <span className="h-1 w-3/5 rounded-full bg-border" />
              <span className="h-1 w-2/3 rounded-full bg-border" />
            </span>
          )}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-surface to-transparent" />
        </span>
      </span>
      <span className="flex items-start gap-2.5 border-t border-border px-4 py-3">
        {task ? (
          <button type="button" aria-label={task.done ? `Mark "${title}" not done` : `Mark "${title}" done`}
            onClick={(e) => { e.stopPropagation(); onToggleTask?.(task.id) }}
            className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
              task.done ? 'border-transparent bg-success text-accent-contrast' : 'border-border-strong text-transparent hover:border-accent hover:text-accent')}>
            <Check size={12} strokeWidth={3} aria-hidden />
          </button>
        ) : (
          <FileText size={16} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            {note.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Pinned" />}
            <span className={cn('truncate text-[14px] font-semibold', note.title ? 'text-fg' : 'text-subtle', task?.done && 'text-muted line-through')}>
              {title}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-[12px] text-subtle">
            {task?.due ? (
              <>
                <CalendarClock size={12} aria-hidden />
                <span>{relativeDueLabel(task.due)}</span>
              </>
            ) : (
              <span>{noteDate(note.updatedAt)}</span>
            )}
            {note.week && (
              <>
                <span aria-hidden>·</span>
                <span>Week {note.week}</span>
              </>
            )}
          </span>
        </span>
      </span>
    </div>
  )
}
