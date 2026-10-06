import { Pin } from 'lucide-react'
import { cn } from '@/lib/cn'
import { noteDate } from './note-format'
import type { NoteMeta } from './types'

/** A note in a folder: a small sheet of paper with its first lines on it. */
export function NoteCard({
  note,
  dragging,
  onOpen,
  onContextMenu,
  dragProps,
}: {
  note: NoteMeta
  dragging?: boolean
  onOpen: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  dragProps?: React.HTMLAttributes<HTMLElement> & { draggable?: boolean }
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      {...dragProps}
      className={cn(
        'group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface text-left',
        'transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg focus-visible:outline-2 focus-visible:outline-accent',
        dragging && 'opacity-40',
      )}
    >
      <span className="relative block h-28 overflow-hidden border-b border-border bg-surface-2/60 px-4 pt-3.5">
        <span className="line-clamp-5 text-[11.5px] leading-[1.45] whitespace-pre-line text-muted">
          {note.excerpt || 'Empty note'}
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-2/90 to-transparent" />
      </span>
      <span className="flex flex-col gap-1 px-4 py-3">
        <span className="flex items-center gap-1.5">
          {note.pinned && <Pin size={12} className="shrink-0 text-accent" aria-label="Pinned" />}
          <span className={cn('truncate text-[14px] font-semibold', note.title ? 'text-fg' : 'text-subtle')}>
            {note.title || 'Untitled note'}
          </span>
        </span>
        <span className="flex items-center gap-2 text-[12px] text-subtle">
          <span>{noteDate(note.updatedAt)}</span>
          {note.week && (
            <>
              <span aria-hidden>·</span>
              <span>Week {note.week}</span>
            </>
          )}
        </span>
      </span>
    </button>
  )
}
