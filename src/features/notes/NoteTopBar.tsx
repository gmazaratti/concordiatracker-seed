import { Link } from 'react-router-dom'
import { ArrowLeft, BookmarkPlus, Check, CloudOff, FileDown, History, Loader2, MessageSquarePlus, PanelRight, PanelRightClose, Settings2, Share2, Trash2 } from 'lucide-react'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { cn } from '@/lib/cn'
import type { SaveStatus } from './collab/NoteProvider'
import type { NoteRole } from './types'

export interface LivePerson {
  uid: string
  name: string
  color: string
  avatar: string | null
  /** Looking at the note now, or with it open in a background tab. */
  status?: 'active' | 'idle'
}

/** Title, save state and who is here on the left; actions on the right. */
export function NoteTopBar(p: {
  back: string
  title: string
  onTitle: (v: string) => void
  canEdit: boolean
  role: NoteRole
  status: SaveStatus
  here: LivePerson[]
  canComment: boolean
  onComment: () => void
  onShare: () => void
  onPageSetup: () => void
  onExport: () => void
  onHistory: () => void
  onTemplate: () => void
  onTrash: () => void
  panel: boolean
  onPanel: () => void
  /** Exports, study tools and the like: added after "Export as PDF". */
  extra?: MenuItem[]
}) {
  const owner = p.role === 'owner'
  const menu: MenuItem[] = [
    ...(p.canEdit ? [{ id: 'page', label: 'Page setup', icon: Settings2, onSelect: p.onPageSetup }] : []),
    { id: 'pdf', label: 'Export as PDF', icon: FileDown, onSelect: p.onExport },
    ...(p.extra ?? []),
    { id: 'history', label: 'Version history', icon: History, onSelect: p.onHistory },
    ...(owner
      ? [
          { id: 'template', label: 'Save as template', icon: BookmarkPlus, onSelect: p.onTemplate },
          { id: 'trash', label: 'Move to trash', icon: Trash2, onSelect: p.onTrash, danger: true, separated: true },
        ]
      : []),
  ]
  return (
    <div className="ct-tips flex h-12 shrink-0 items-center gap-2 border-b border-border bg-canvas px-3">
      <Link to={p.back} aria-label="Back" className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
        <ArrowLeft size={17} aria-hidden />
      </Link>
      <input value={p.title} onChange={(e) => p.onTitle(e.target.value)} readOnly={!p.canEdit} maxLength={200} placeholder="Untitled note" aria-label="Title"
        className="min-w-0 flex-1 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-[16px] font-semibold text-fg outline-none transition-colors duration-150 placeholder:text-subtle hover:border-border focus:border-accent" />
      <span className={cn('flex shrink-0 items-center gap-1 text-[12px]', p.status === 'error' ? 'text-danger' : 'text-subtle')} role="status">
        {p.status === 'saving' ? <Loader2 size={13} className="animate-spin" aria-hidden /> : p.status === 'error' ? <CloudOff size={13} aria-hidden /> : <Check size={13} aria-hidden />}
        {p.status === 'saving' ? 'Saving' : p.status === 'error' ? 'Not saved' : 'Saved'}
      </span>

      <div className="ml-2 flex shrink-0 -space-x-1.5">
        {p.here.slice(0, 5).map((h) => (
          <span key={h.uid} role="img" aria-label={h.status === 'idle' ? `${h.name} has this note open in another tab` : `${h.name} is in this note now`}
            className="ct-animate-pop rounded-full transition-shadow duration-300"
            style={{ boxShadow: `0 0 0 2px var(--ct-canvas), 0 0 0 4px ${h.status === 'idle' ? 'var(--ct-subtle)' : 'var(--ct-success)'}` }}>
            <PersonAvatar person={{ handle: '', name: h.name, avatar_url: h.avatar }} className="size-7" />
          </span>
        ))}
      </div>
      <button type="button" onClick={p.onComment} disabled={!p.canComment} title={p.canComment ? 'Comment on the selection' : 'Select some text to comment on it'}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg disabled:opacity-40">
        <MessageSquarePlus size={15} aria-hidden />Comment
      </button>
      {owner && (
        <button type="button" onClick={p.onShare} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover">
          <Share2 size={14} aria-hidden />Share
        </button>
      )}
      <DropdownMenu ariaLabel="Note options" triggerClassName="size-8 shrink-0" items={menu} />
      <button type="button" aria-pressed={p.panel} aria-label={p.panel ? 'Hide the side panel' : 'Show the side panel'} onClick={p.onPanel}
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
        {p.panel ? <PanelRightClose size={16} aria-hidden /> : <PanelRight size={16} aria-hidden />}
      </button>
    </div>
  )
}
