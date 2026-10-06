import { Pin, Users } from 'lucide-react'
import { cn } from '@/lib/cn'
import { withAlpha } from '@/lib/course-color'
import { folderHex, FOLDER_ICON_MAP, DEFAULT_FOLDER_ICON } from './folder-style'
import { noteDate } from './note-format'

export type DropMode = 'into' | 'before' | 'after' | null

/**
 * One folder in the grid — a class is a folder too, wearing its course colour.
 * The card is the drag handle and the drop target: dropping onto its middle
 * puts the dragged thing inside; near its edges, beside it.
 */
export function FolderCard({
  name,
  subtitle,
  icon,
  color,
  count,
  folders = 0,
  updatedAt,
  pinned,
  shared,
  drop,
  dragging,
  onOpen,
  onContextMenu,
  dragProps,
}: {
  name: string
  subtitle?: string
  icon: string
  color: string
  count: number
  /** Folders directly inside this one (a class dragged in counts). */
  folders?: number
  updatedAt: string | null
  pinned?: boolean
  shared?: boolean
  drop: DropMode
  dragging?: boolean
  onOpen: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  dragProps?: React.HTMLAttributes<HTMLElement> & { draggable?: boolean }
}) {
  const Icon = FOLDER_ICON_MAP[icon] ?? DEFAULT_FOLDER_ICON
  const hex = folderHex(color)
  return (
    <button
      type="button"
      onClick={onOpen}
      onContextMenu={onContextMenu}
      {...dragProps}
      className={cn(
        'group relative flex h-full w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-left',
        'transition-[transform,box-shadow,border-color,opacity] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lg focus-visible:outline-2 focus-visible:outline-accent',
        drop === 'into' && 'scale-[1.03] border-accent shadow-lg ring-2 ring-accent/50',
        dragging && 'opacity-40',
      )}
    >
      {drop === 'before' && <span className="absolute inset-y-3 -left-2 w-1 rounded-full bg-accent" aria-hidden />}
      {drop === 'after' && <span className="absolute inset-y-3 -right-2 w-1 rounded-full bg-accent" aria-hidden />}
      <span className="flex items-start justify-between">
        <span
          className="grid size-12 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{ background: withAlpha(hex, 0.16), color: hex }}
        >
          <Icon size={24} aria-hidden />
        </span>
        <span className="flex items-center gap-1.5 text-subtle">
          {shared && <Users size={14} aria-label="Shared" />}
          {pinned && <Pin size={14} className="text-accent" aria-label="Pinned" />}
        </span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-semibold text-fg">{name}</span>
        {subtitle && <span className="block truncate text-[12.5px] text-muted">{subtitle}</span>}
      </span>
      <span className="mt-auto flex items-center gap-2 text-[12px] text-subtle">
        <span>
          {folders > 0 && `${folders} ${folders === 1 ? 'folder' : 'folders'} · `}
          {count} {count === 1 ? 'note' : 'notes'}
        </span>
        {updatedAt && (
          <>
            <span aria-hidden>·</span>
            <span>{noteDate(updatedAt)}</span>
          </>
        )}
      </span>
    </button>
  )
}
