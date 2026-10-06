import { cn } from '@/lib/cn'
import { NoteInfoPanel } from './NoteInfoPanel'
import { CommentsPanel } from './comments/CommentsPanel'

/** The side panel: two tabs, Details and Comments, sliding in and out. */
export function NoteSidePanel({ open, tab, onTab, commentCount, details, comments }: {
  open: boolean
  tab: 'details' | 'comments'
  onTab: (t: 'details' | 'comments') => void
  commentCount: number
  details: Parameters<typeof NoteInfoPanel>[0]
  comments: Parameters<typeof CommentsPanel>[0]
}) {
  return (
    <aside aria-label="Note details"
      className={cn('shrink-0 overflow-hidden border-l border-border bg-surface/40 transition-[width,opacity] duration-300 ease-out', open ? 'w-80 opacity-100' : 'w-0 border-l-0 opacity-0')}>
      <div className="flex h-full w-80 flex-col">
        <div role="tablist" aria-label="Side panel" className="flex shrink-0 gap-1 border-b border-border px-3 pt-2">
          {(['details', 'comments'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}
              className={cn('relative px-2.5 pb-2 text-[13px] font-medium capitalize transition-colors duration-150',
                tab === t ? 'text-fg' : 'text-muted hover:text-fg')}>
              {t}
              {t === 'comments' && commentCount > 0 && (
                <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 text-[11px] text-accent tabular-nums">{commentCount}</span>
              )}
              <span className={cn('absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent transition-opacity duration-200', tab === t ? 'opacity-100' : 'opacity-0')} />
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'details' ? <NoteInfoPanel {...details} /> : <CommentsPanel {...comments} />}
        </div>
      </div>
    </aside>
  )
}
