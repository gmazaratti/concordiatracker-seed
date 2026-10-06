import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronRight, FolderPlus, Inbox, Search, Share2, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { FolderCard } from './FolderCard'
import { NoteCard } from './NoteCard'
import { NewNoteButton } from './NewNoteButton'
import { SearchResults } from './SearchResults'
import { SharedSection } from './SharedSection'
import { FolderDialog } from './FolderDialog'
import { useNotesData } from './useNotesData'
import { useNotesDnd } from './useNotesDnd'
import { useNoteMenus } from './useNoteMenus'
import { useFlip } from './useFlip'
import { childrenOf, pathTo, reorder } from './folder-tree'
import { groupNotes } from './note-format'
import { autoLinkFor, weekOfTerm } from './auto-link'
import type { NoteFolder, NoteTemplate } from './types'

/**
 * The Notes home (folderId null) and the inside of any folder: one grid of
 * folders — classes are folders — then the notes in this folder.
 * Drag a card onto a folder to put it inside; drag beside a card to reorder.
 */
export function FolderBrowser({ folderId }: { folderId: string | null | 'general' }) {
  const navigate = useNavigate()
  const { courses, pastCourses } = useAppData()
  const data = useNotesData()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const grid = useRef<HTMLDivElement>(null)

  const allCourses = useMemo(() => [...courses, ...pastCourses], [courses, pastCourses])
  const courseById = useMemo(() => new Map(allCourses.map((c) => [c.id, c])), [allCourses])
  const general = folderId === 'general'
  const here = general || folderId === null ? null : (data.folders.find((f) => f.id === folderId) ?? null)
  const current = folderId === null || general ? null : folderId

  const label = (f: NoteFolder) => (f.courseId ? courseById.get(f.courseId)?.code || f.name : f.name)
  const style = (f: NoteFolder) => (f.courseId ? courseById.get(f.courseId)?.color ?? f.color : f.color)
  const mine = data.notes.filter((n) => n.ownerId === data.myId)

  const subfolders = general ? [] : childrenOf(data.folders, current)
  const pinned = folderId === null ? data.folders.filter((f) => f.pinned) : []
  const notesHere = general ? mine.filter((n) => !n.folderId) : current ? data.notes.filter((n) => n.folderId === current) : []
  const stats = (id: string) => {
    const list = data.notes.filter((n) => n.folderId === id)
    return { count: list.length, folders: data.folders.filter((f) => f.parentId === id).length, updatedAt: list.reduce<string | null>((m, n) => (!m || n.updatedAt > m ? n.updatedAt : m), null) }
  }

  useFlip(grid, subfolders.map((f) => f.id).join())

  const open = { folder: (id: string) => navigate(`/app/notes/f/${id}`), note: (id: string) => navigate(`/app/notes/n/${id}`) }
  const menus = useNoteMenus(data, open)
  const dnd = useNotesDnd({
    folders: data.folders,
    onMoveFolder: (id, parentId) => void data.patchFolder(id, { parentId }),
    onMoveNote: (id, fid) => {
      const target = fid ? data.folders.find((f) => f.id === fid) : null
      void data.patchNote(id, { folderId: fid, ...(target?.courseId ? { courseId: target.courseId } : {}) })
    },
    onReorder: (id, beforeId, afterId) => {
      const sibs = subfolders
      const idx = afterId ? sibs.findIndex((f) => f.id === afterId) + 1 : -1
      const before = beforeId ?? (idx >= 0 && idx < sibs.length ? sibs[idx].id : null)
      void data.reposition(reorder(sibs, id, before))
    },
  })

  const newNote = async (template: NoteTemplate | null) => {
    const now = new Date()
    let init: Parameters<typeof data.createNote>[0] = { content: template?.content }
    if (here) {
      init = { ...init, folderId: here.id }
      if (here.courseId) init = { ...init, courseId: here.courseId, week: weekOfTerm(now, term.start, term.end) }
    } else if (!general) {
      // Writing during a scheduled class files the note in that class.
      const link = autoLinkFor(courses, now, term)
      const cls = link && data.folders.find((f) => f.courseId === link.courseId)
      if (link) init = { ...init, courseId: link.courseId, week: link.week, lectureDate: link.lectureDate, title: link.title, folderId: cls?.id ?? null }
    }
    const meta = await data.createNote(init).catch(() => null)
    if (meta) navigate(`/app/notes/n/${meta.id}`, { state: { autoLinked: !here && !general && !!init.courseId } })
  }

  const crumbs = here ? pathTo(data.folders, here.id) : []
  const title = general ? 'General' : here ? label(here) : 'Notes'
  const subtitle = here?.courseId ? courseById.get(here.courseId)?.title : undefined
  const groups = groupNotes(notesHere, !!here?.courseId)

  return (
    <div className="ct-notes-in mx-auto w-full max-w-6xl px-6 pt-6 pb-16 lg:px-10">
      <nav aria-label="Folder path" className="flex min-h-6 flex-wrap items-center gap-1 text-[13px] text-subtle">
        {folderId !== null && (
          <Link to="/app/notes" {...dnd.dropProps(null, { reorderable: false })} className={cn('rounded px-1 hover:text-fg', dnd.modeFor(null) && 'bg-accent-soft text-fg')}>
            Notes
          </Link>
        )}
        {crumbs.slice(0, -1).map((f) => (
          <span key={f.id} className="flex items-center gap-1">
            <ChevronRight size={13} aria-hidden />
            <Link to={`/app/notes/f/${f.id}`} {...dnd.dropProps(f.id, { reorderable: false })} className={cn('rounded px-1 hover:text-fg', dnd.modeFor(f.id) && 'bg-accent-soft text-fg')}>
              {label(f)}
            </Link>
          </span>
        ))}
      </nav>

      <header className="mt-1 flex flex-wrap items-end gap-3">
        {folderId !== null && (
          <Link to={crumbs.length > 1 ? `/app/notes/f/${crumbs[crumbs.length - 2].id}` : '/app/notes'} aria-label="Back" title="Back"
            className="mb-1 grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
            <ArrowLeft size={17} aria-hidden />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[30px] leading-tight font-semibold text-fg">{title}</h1>
          {subtitle && <p className="truncate text-[14px] text-muted">{subtitle}</p>}
        </div>
        <label className="flex h-9 w-60 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 focus-within:border-accent">
          <Search size={14} className="shrink-0 text-subtle" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all notes" aria-label="Search all notes"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle" />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-subtle hover:text-fg">
              <X size={14} aria-hidden />
            </button>
          )}
        </label>
        {here && (
          <Button variant="outline" size="sm" onClick={() => menus.openShare('folder', here.id, label(here))}>
            <Share2 size={15} aria-hidden />
            Share folder
          </Button>
        )}
        {!general && (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <FolderPlus size={15} aria-hidden />
            New folder
          </Button>
        )}
        <NewNoteButton templates={data.templates} onNew={(t) => void newNote(t)} onDeleteTemplate={(id) => void data.removeTemplate(id)} />
      </header>

      {query.trim() ? (
        <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-surface">
          <SearchResults query={query.trim()} courses={allCourses} selectedId={null} onSelect={open.note} />
        </div>
      ) : data.error ? (
        <p className="mt-8 text-[14px] text-danger">{data.error}</p>
      ) : (
        <>
          {pinned.length > 0 && (
            <Section label="Pinned">
              {pinned.map((f) => (
                <FolderCard key={`p-${f.id}`} name={label(f)} icon={f.icon} color={style(f)} pinned {...stats(f.id)} drop={null}
                  subtitle={f.courseId ? courseById.get(f.courseId)?.title : undefined}
                  onOpen={() => open.folder(f.id)} onContextMenu={(e) => menus.folderMenu(e, f, label(f))} />
              ))}
            </Section>
          )}

          {(subfolders.length > 0 || folderId === null || data.loading) && (
            <Section label={folderId === null ? 'Folders' : 'Folders'} gridRef={grid}>
              {data.loading &&
                [0, 1, 2, 3].map((i) => <div key={i} className="ct-shimmer h-40 rounded-2xl" />)}
              {subfolders.map((f) => (
                <div key={f.id} data-flip={f.id} className="h-40" {...dnd.dropProps(f.id, { reorderable: true })}>
                  <FolderCard name={label(f)} icon={f.icon} color={style(f)} pinned={f.pinned} {...stats(f.id)}
                    subtitle={f.courseId ? courseById.get(f.courseId)?.title : undefined}
                    drop={dnd.modeFor(f.id)} dragging={dnd.dragged?.id === f.id}
                    onOpen={() => open.folder(f.id)} onContextMenu={(e) => menus.folderMenu(e, f, label(f))}
                    dragProps={dnd.dragProps('folder', f.id)} />
                </div>
              ))}
              {folderId === null && !data.loading && (
                <div className="h-40" {...dnd.dropProps(null, { reorderable: false })}>
                  <FolderCard name="General" subtitle="Notes not in a folder" icon="folder" color="slate" drop={dnd.modeFor(null)}
                    count={mine.filter((n) => !n.folderId).length} updatedAt={null} onOpen={() => navigate('/app/notes/f/general')} />
                </div>
              )}
            </Section>
          )}

          {folderId !== null &&
            (notesHere.length === 0 ? (
              <div className="mt-10 flex flex-col items-center gap-2 text-center">
                <Inbox size={26} className="text-subtle" aria-hidden />
                <p className="text-[14px] text-muted">No notes here yet. Press New note to start one.</p>
              </div>
            ) : (
              groups.map((g) => (
                <Section key={g.label || 'notes'} label={g.label || 'Notes'}>
                  {g.notes.map((n) => (
                    <div key={n.id} className="h-48">
                      <NoteCard note={n} dragging={dnd.dragged?.id === n.id} onOpen={() => open.note(n.id)}
                        onContextMenu={(e) => menus.noteMenu(e, n, n.ownerId === data.myId)}
                        dragProps={n.ownerId === data.myId ? dnd.dragProps('note', n.id) : undefined} />
                    </div>
                  ))}
                </Section>
              ))
            ))}

          {folderId === null && <SharedSection items={data.shared} />}
        </>
      )}

      {menus.layer}
      {creating && (
        <FolderDialog title="New folder" initial={{ name: '', icon: 'folder', color: 'blue' }} onClose={() => setCreating(false)}
          onSave={(v) => {
            void data.addFolder({ ...v, parentId: current })
            setCreating(false)
          }} />
      )}
    </div>
  )
}

function Section({ label, children, gridRef }: { label: string; children: React.ReactNode; gridRef?: React.RefObject<HTMLDivElement | null> }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[12px] font-semibold tracking-wide text-subtle uppercase">{label}</h2>
      <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4">
        {children}
      </div>
    </section>
  )
}
