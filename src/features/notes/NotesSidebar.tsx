import { useState } from 'react'
import { Folder, FolderPlus, Inbox, NotebookText, Pencil, Search, Trash2, X } from 'lucide-react'
import type { Course } from '@/data/types'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/cn'
import { courseColor } from '@/lib/course-color'
import type { NoteFolder, NoteMeta, NotesFilter } from './types'

const sameFilter = (a: NotesFilter, b: NotesFilter) =>
  a.kind === b.kind &&
  (a.kind !== 'course' || a.courseId === (b as { courseId: string }).courseId) &&
  (a.kind !== 'folder' || a.folderId === (b as { folderId: string }).folderId)

/** Search, then the two kinds of note (all, general), then one row per class,
 *  then folders. Counts are live, so a class you have never written for says 0. */
export function NotesSidebar({
  notes,
  courses,
  folders,
  filter,
  onFilter,
  query,
  onQuery,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: {
  notes: NoteMeta[]
  courses: Course[]
  folders: NoteFolder[]
  filter: NotesFilter
  onFilter: (f: NotesFilter) => void
  query: string
  onQuery: (q: string) => void
  onAddFolder: (name: string) => void
  onRenameFolder: (id: string, name: string) => void
  onDeleteFolder: (id: string) => void
}) {
  const [naming, setNaming] = useState<{ id: string | null; value: string } | null>(null)
  const count = (pred: (n: NoteMeta) => boolean) => notes.filter(pred).length

  const submitName = () => {
    const v = naming?.value.trim()
    if (v) {
      if (naming?.id) onRenameFolder(naming.id, v)
      else onAddFolder(v)
    }
    setNaming(null)
  }

  return (
    <nav aria-label="Notes" className="flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-border">
      <div className="p-3">
        <label className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 focus-within:border-accent">
          <Search size={14} className="shrink-0 text-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => onQuery('')} className="text-subtle hover:text-fg">
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        <Row icon={<NotebookText size={15} />} label="All notes" n={notes.length} active={!query && filter.kind === 'all'} onClick={() => onFilter({ kind: 'all' })} />
        <Row icon={<Inbox size={15} />} label="General" n={count((n) => !n.courseId)} active={!query && filter.kind === 'general'} onClick={() => onFilter({ kind: 'general' })} />

        {courses.length > 0 && <Heading>Classes</Heading>}
        {courses.map((c) => {
          const f: NotesFilter = { kind: 'course', courseId: c.id }
          return (
            <Row
              key={c.id}
              icon={<span className="size-2.5 rounded-full" style={{ background: courseColor(c.color).hex }} />}
              label={c.code || c.title || 'Untitled course'}
              n={count((n) => n.courseId === c.id)}
              active={!query && sameFilter(filter, f)}
              onClick={() => onFilter(f)}
            />
          )
        })}

        <div className="mt-4 flex items-center justify-between pr-1">
          <Heading inline>Folders</Heading>
          <button
            type="button"
            onClick={() => setNaming({ id: null, value: '' })}
            aria-label="New folder"
            title="New folder"
            className="grid size-7 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
          >
            <FolderPlus size={15} aria-hidden />
          </button>
        </div>
        {folders.map((f) =>
          naming?.id === f.id ? (
            <NameInput key={f.id} value={naming.value} onChange={(v) => setNaming({ id: f.id, value: v })} onDone={submitName} onCancel={() => setNaming(null)} />
          ) : (
            <div key={f.id} className="group relative">
              <Row
                icon={<Folder size={15} />}
                label={f.name}
                n={count((n) => n.folderId === f.id)}
                active={!query && filter.kind === 'folder' && filter.folderId === f.id}
                onClick={() => onFilter({ kind: 'folder', folderId: f.id })}
              />
              <span className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <DropdownMenu
                  ariaLabel={`${f.name} options`}
                  triggerClassName="size-7"
                  items={[
                    { id: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setNaming({ id: f.id, value: f.name }) },
                    { id: 'delete', label: 'Delete folder (keeps notes)', icon: Trash2, danger: true, separated: true, onSelect: () => onDeleteFolder(f.id) },
                  ]}
                />
              </span>
            </div>
          ),
        )}
        {naming && naming.id === null && (
          <NameInput value={naming.value} onChange={(v) => setNaming({ id: null, value: v })} onDone={submitName} onCancel={() => setNaming(null)} />
        )}
        {folders.length === 0 && !naming && <p className="px-2.5 py-1 text-[12px] text-subtle">No folders yet.</p>}
      </div>
    </nav>
  )
}

function Heading({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <p className={cn('px-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase', !inline && 'mt-4 mb-1')}>{children}</p>
  )
}

function Row({ icon, label, n, active, onClick }: { icon: React.ReactNode; label: string; n: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 pr-9 text-left text-[13px] transition-colors duration-150',
        active ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <span className="grid w-4 shrink-0 place-items-center text-subtle" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-[11.5px] text-subtle tabular-nums">{n}</span>
    </button>
  )
}

function NameInput({ value, onChange, onDone, onCancel }: { value: string; onChange: (v: string) => void; onDone: () => void; onCancel: () => void }) {
  return (
    <input
      autoFocus
      value={value}
      maxLength={80}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onDone}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDone()
        if (e.key === 'Escape') onCancel()
      }}
      placeholder="Folder name"
      aria-label="Folder name"
      className="my-0.5 h-8 w-full rounded-lg border border-accent bg-surface-2 px-2.5 text-[13px] text-fg outline-none"
    />
  )
}
