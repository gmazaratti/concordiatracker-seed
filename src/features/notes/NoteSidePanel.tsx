import { cn } from '@/lib/cn'
import { NoteInfoPanel } from './NoteInfoPanel'
import { CommentsPanel } from './comments/CommentsPanel'

export type SideTab = 'details' | 'comments' | 'slides' | 'file'
const LABELS: Record<SideTab, string> = { details: 'Details', comments: 'Comments', slides: 'Slides', file: 'File' }

/** The side panel: Details, Comments and Slides, sliding in and out. Slides
 *  get a wider panel, because a slide at 320px is unreadable. */
export function NoteSidePanel({ open, tab, onTab, commentCount, details, comments, slides, file }: {
  open: boolean
  tab: SideTab
  onTab: (t: SideTab) => void
  commentCount: number
  details: Parameters<typeof NoteInfoPanel>[0]
  comments: Parameters<typeof CommentsPanel>[0]
  slides: React.ReactNode
  /** A file opened from a link in the note; the File tab exists only while one is. */
  file: React.ReactNode | null
}) {
  const width = tab === 'file' ? 'w-[36rem]' : tab === 'slides' ? 'w-[30rem]' : 'w-80'
  const tabs: SideTab[] = file ? ['details', 'comments', 'slides', 'file'] : ['details', 'comments', 'slides']
  return (
    <aside aria-label="Note details"
      className={cn('shrink-0 overflow-hidden border-l border-border bg-surface/40 transition-[width,opacity] duration-300 ease-out', open ? `${width} opacity-100` : 'w-0 border-l-0 opacity-0')}>
      <div className={cn('flex h-full flex-col', width)}>
        <div role="tablist" aria-label="Side panel" className="flex shrink-0 gap-1 border-b border-border px-3 pt-2">
          {tabs.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => onTab(t)}
              className={cn('relative px-2.5 pb-2 text-[13px] font-medium transition-colors duration-150',
                tab === t ? 'text-fg' : 'text-muted hover:text-fg')}>
              {LABELS[t]}
              {t === 'comments' && commentCount > 0 && (
                <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 text-[11px] text-accent tabular-nums">{commentCount}</span>
              )}
              <span className={cn('absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-accent transition-opacity duration-200', tab === t ? 'opacity-100' : 'opacity-0')} />
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'details' ? <NoteInfoPanel {...details} /> : tab === 'comments' ? <CommentsPanel {...comments} /> : tab === 'file' && file ? file : slides}
        </div>
      </div>
    </aside>
  )
}
