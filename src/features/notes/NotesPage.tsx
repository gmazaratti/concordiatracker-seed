import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Monitor, NotebookPen, X } from 'lucide-react'
import type { JSONContent } from '@tiptap/react'
import { useAppData } from '@/app/providers/app-data'
import { term } from '@/data/mock'
import { useT } from '@/i18n/i18n'
import { NotesSidebar } from './NotesSidebar'
import { NoteList } from './NoteList'
import { NoteEditor } from './NoteEditor'
import { NewNoteButton } from './NewNoteButton'
import { SearchResults } from './SearchResults'
import { VersionHistory } from './VersionHistory'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { useNotesData } from './useNotesData'
import { autoLinkFor, weekOfTerm, type AutoLink } from './auto-link'
import { updateNote } from './notes-api'
import { opened } from './opened-cache'
import type { NotesFilter, NoteTemplate } from './types'

/** ?c=<course id> · ?f=<folder id> · ?v=general — the filter, in the URL so a
 *  class's notes are linkable and Back returns to them. ?note=<id> is the open note. */
function filterFrom(p: URLSearchParams): NotesFilter {
  if (p.get('c')) return { kind: 'course', courseId: p.get('c')! }
  if (p.get('f')) return { kind: 'folder', folderId: p.get('f')! }
  if (p.get('v') === 'general') return { kind: 'general' }
  return { kind: 'all' }
}

export function NotesPage() {
  const t = useT()
  const { courses, pastCourses, assessments } = useAppData()
  const data = useNotesData()
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState(false)
  const [templateDoc, setTemplateDoc] = useState<JSONContent | null>(null)
  const [linked, setLinked] = useState<(AutoLink & { noteId: string }) | null>(null)
  const [editorKey, setEditorKey] = useState(0)

  const filter = filterFrom(params)
  const selectedId = params.get('note')

  // This term's classes, plus any older class you still have notes for.
  const noteCourses = useMemo(() => {
    const withNotes = new Set(data.notes.map((n) => n.courseId))
    return [...courses, ...pastCourses.filter((c) => withNotes.has(c.id))]
  }, [courses, pastCourses, data.notes])

  const visible = useMemo(() => {
    switch (filter.kind) {
      case 'general':
        return data.notes.filter((n) => !n.courseId)
      case 'course':
        return data.notes.filter((n) => n.courseId === filter.courseId)
      case 'folder':
        return data.notes.filter((n) => n.folderId === filter.folderId)
      default:
        return data.notes
    }
  }, [data.notes, filter])

  const setParam = (next: Record<string, string | null>) => {
    const p = new URLSearchParams(params)
    for (const [k, v] of Object.entries(next)) {
      if (v === null) p.delete(k)
      else p.set(k, v)
    }
    setParams(p)
  }
  const select = (id: string | null) => setParam({ note: id })
  const changeFilter = (f: NotesFilter) => {
    setQuery('')
    setParam({
      c: f.kind === 'course' ? f.courseId : null,
      f: f.kind === 'folder' ? f.folderId : null,
      v: f.kind === 'general' ? 'general' : null,
    })
  }

  const newNote = async (template: NoteTemplate | null) => {
    const now = new Date()
    let link: AutoLink | null = null
    let init: Parameters<typeof data.createNote>[0] = { content: template?.content }
    if (filter.kind === 'course') {
      const auto = autoLinkFor(courses.filter((c) => c.id === filter.courseId), now, term)
      init = { ...init, courseId: filter.courseId, week: auto?.week ?? weekOfTerm(now, term.start, term.end), lectureDate: auto?.lectureDate ?? null, title: auto?.title ?? '' }
    } else if (filter.kind === 'folder') {
      init = { ...init, folderId: filter.folderId }
    } else if (filter.kind === 'all') {
      // Writing during a scheduled class files it under that class and week.
      link = autoLinkFor(courses, now, term)
      if (link) init = { ...init, courseId: link.courseId, week: link.week, lectureDate: link.lectureDate, title: link.title }
    }
    const meta = await data.createNote(init).catch(() => null)
    if (!meta) return
    setQuery('')
    setLinked(link ? { ...link, noteId: meta.id } : null)
    select(meta.id)
  }

  const removeAutoLink = () => {
    if (!linked) return
    void data.patchNote(linked.noteId, { courseId: null, week: null, lectureDate: null })
    const o = opened.get(linked.noteId)
    if (o) opened.set(linked.noteId, { ...o, courseId: null, week: null, lectureDate: null })
    setLinked(null)
    setEditorKey((k) => k + 1)
  }

  const heading =
    filter.kind === 'course'
      ? noteCourses.find((c) => c.id === filter.courseId)?.code ?? 'Class'
      : filter.kind === 'folder'
        ? data.folders.find((f) => f.id === filter.folderId)?.name ?? 'Folder'
        : filter.kind === 'general'
          ? 'General'
          : t('nav.notes')

  return (
    <>
      <div className="flex flex-col items-center gap-3 px-6 py-24 text-center md:hidden">
        <Monitor size={28} className="text-subtle" aria-hidden />
        <p className="text-[15px] font-semibold text-fg">Notes is on desktop for now</p>
        <p className="max-w-xs text-[13.5px] text-muted">Open ConcordiaTracker on a laptop or a wider window to write notes. Phone support is coming.</p>
      </div>

      <div className="hidden h-full min-h-0 md:flex">
        <NotesSidebar
          notes={data.notes}
          courses={noteCourses}
          folders={data.folders}
          filter={filter}
          onFilter={changeFilter}
          query={query}
          onQuery={setQuery}
          onAddFolder={(n) => void data.addFolder(n)}
          onRenameFolder={(id, n) => void data.renameFolder(id, n)}
          onDeleteFolder={(id) => {
            void data.removeFolder(id)
            if (filter.kind === 'folder' && filter.folderId === id) changeFilter({ kind: 'all' })
          }}
        />

        <section aria-label="Note list" className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-border">
          <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
            <h1 className="truncate text-[16px] font-semibold text-fg">{query ? 'Search' : heading}</h1>
            <NewNoteButton templates={data.templates} onNew={(tpl) => void newNote(tpl)} onDeleteTemplate={(id) => void data.removeTemplate(id)} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {query.trim() ? (
              <SearchResults query={query.trim()} courses={noteCourses} selectedId={selectedId} onSelect={select} />
            ) : data.error ? (
              <p className="p-4 text-[13px] text-danger">{data.error}</p>
            ) : data.loading ? (
              <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <div key={i} className="ct-shimmer h-12 rounded-lg" />)}</div>
            ) : visible.length === 0 ? (
              <p className="px-4 py-6 text-[13px] text-subtle">No notes here yet. Press New note to start one.</p>
            ) : (
              <NoteList notes={visible} filter={filter} courses={noteCourses} selectedId={selectedId} onSelect={select} />
            )}
          </div>
        </section>

        <section aria-label="Editor" className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          {linked && linked.noteId === selectedId && (
            <div role="status" className="flex items-center gap-2 border-b border-border bg-accent-soft px-4 py-2 text-[13px] text-fg">
              <span className="min-w-0 flex-1">
                Linked to <strong>{noteCourses.find((c) => c.id === linked.courseId)?.code}</strong>
                {linked.week ? `, week ${linked.week}` : ''} because it’s class time.
              </span>
              <button type="button" onClick={removeAutoLink} className="font-medium text-accent hover:underline">
                Remove link
              </button>
              <button type="button" aria-label="Dismiss" onClick={() => setLinked(null)} className="text-subtle hover:text-fg">
                <X size={14} aria-hidden />
              </button>
            </div>
          )}
          {selectedId ? (
            <NoteEditor
              key={`${selectedId}:${editorKey}`}
              noteId={selectedId}
              courses={noteCourses}
              folders={data.folders}
              assessments={assessments}
              onMeta={(id, patch, persist) => (persist ? void data.patchNote(id, patch) : data.patchLocal(id, patch))}
              onHistory={() => setHistory(true)}
              onSaveTemplate={setTemplateDoc}
              onTrash={() => {
                void data.trash(selectedId)
                select(null)
              }}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <NotebookPen size={30} className="text-subtle" aria-hidden />
              <p className="text-[14px] text-muted">Pick a note, or start a new one.</p>
            </div>
          )}
        </section>
      </div>

      {history && selectedId && (
        <VersionHistory
          noteId={selectedId}
          onClose={() => setHistory(false)}
          onRestore={(v) => {
            void updateNote(selectedId, { title: v.title, content: v.content }).then(() => {
              opened.delete(selectedId)
              data.patchLocal(selectedId, { title: v.title, updatedAt: new Date().toISOString() })
              setEditorKey((k) => k + 1)
            })
            setHistory(false)
          }}
        />
      )}
      {templateDoc && (
        <SaveTemplateDialog
          onClose={() => setTemplateDoc(null)}
          onSave={async (name) => {
            await data.addTemplate(name, templateDoc)
            setTemplateDoc(null)
          }}
        />
      )}
    </>
  )
}
