import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import { ArrowLeft, Eye, FileText, Lock, PanelRight, PanelRightClose, Share2, Square } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { cn } from '@/lib/cn'
import { noteExtensions } from './editor-extensions'
import { NoteToolbar } from './NoteToolbar'
import { NoteInfoPanel } from './NoteInfoPanel'
import { VersionHistory } from './VersionHistory'
import { SaveTemplateDialog } from './SaveTemplateDialog'
import { ShareDialog } from './ShareDialog'
import { useAutosave } from './useAutosave'
import { useNoteDoc } from './useNoteDoc'
import { useNotePresence } from './useNotePresence'
import { useNotesData } from './useNotesData'
import { useLocalPref } from './useLocalPref'
import { updateNote } from './notes-api'
import { touchNote } from './sharing-api'
import { opened } from './opened-cache'
import type { Note, NoteMeta } from './types'

export function NotePage({ noteId }: { noteId: string }) {
  const doc = useNoteDoc(noteId)
  if (doc.missing) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-24 text-center">
        <Lock size={26} className="text-subtle" aria-hidden />
        <p className="text-[15px] font-semibold text-fg">This note is not available</p>
        <p className="text-[13.5px] text-muted">It may have been deleted, or it is not shared with you.</p>
        <Link to="/app/notes" className="mt-2 text-[13.5px] font-medium text-accent hover:underline">Back to Notes</Link>
      </div>
    )
  }
  if (!doc.note || !doc.role) return <div className="mx-auto mt-24 h-[60vh] w-full max-w-3xl ct-shimmer rounded-2xl" />
  return <LoadedNote key={noteId} note={doc.note} role={doc.role} doc={doc} />
}

function LoadedNote({ note, role, doc }: { note: Note; role: NonNullable<ReturnType<typeof useNoteDoc>['role']>; doc: ReturnType<typeof useNoteDoc> }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { courses, pastCourses, assessments, user } = useAppData()
  const data = useNotesData()
  const [meta, setMeta] = useState<NoteMeta>(note)
  const [title, setTitle] = useState(note.title)
  const [paper, setPaper] = useLocalPref('ct_notes_paper', true)
  const [zoom, setZoom] = useLocalPref('ct_notes_zoom', 100)
  const [panel, setPanel] = useLocalPref('ct_notes_panel', true)
  const [dialog, setDialog] = useState<null | 'history' | 'share' | { template: JSONContent }>(null)
  const autoLinked = (location.state as { autoLinked?: boolean } | null)?.autoLinked && meta.courseId
  const allCourses = useMemo(() => [...courses, ...pastCourses], [courses, pastCourses])
  const canEdit = role === 'owner' || role === 'editor'
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  const me = useMemo(() => (data.myId ? { uid: data.myId, name: user.name, avatar: user.avatarUrl ?? null } : null), [data.myId, user.name, user.avatarUrl])
  const presence = useNotePresence({
    noteId: note.id, me, canEdit,
    onRemoteSave: () => void doc.reload().then((n) => n && applyRemote(n)),
  })
  const save = useAutosave(note.id, (p) => {
    presence.announceSave()
    touchNote(note.id, true)
    if (p.title !== undefined) data.patchLocal(note.id, { title: p.title })
    doc.loadPeople()
  })

  const editor = useEditor({
    extensions: noteExtensions('Start writing…  # for a heading, - for a list, [ ] for a checklist'),
    content: note.content,
    editable: canEdit,
    editorProps: { attributes: { class: 'ct-note-doc', 'aria-label': 'Note' } },
    onUpdate: ({ editor: e }) => {
      const content = e.getJSON()
      opened.set(note.id, { ...(opened.get(note.id) ?? note), content, updatedAt: new Date().toISOString() })
      save.queue({ content, bodyText: e.getText({ blockSeparator: '\n' }) })
    },
  })
  useEffect(() => {
    editorRef.current = editor
  }, [editor])

  function applyRemote(n: Note) {
    setTitle(n.title)
    editorRef.current?.commands.setContent(n.content, { emitUpdate: false })
  }

  // Typing is allowed only while I hold the pen; when I get it back, start from
  // the latest saved copy rather than from what was on screen.
  const wasTyping = useRef(presence.canType)
  useEffect(() => {
    editor?.setEditable(presence.canType)
    if (presence.canType && !wasTyping.current) void doc.reload().then((n) => n && applyRemote(n))
    wasTyping.current = presence.canType
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presence.canType, editor])

  const changeTitle = (v: string) => {
    if (!presence.canType) return
    setTitle(v)
    opened.set(note.id, { ...(opened.get(note.id) ?? note), title: v })
    save.queue({ title: v })
  }
  const changeMeta = (patch: Partial<NoteMeta>) => {
    setMeta((m) => ({ ...m, ...patch }))
    opened.set(note.id, { ...(opened.get(note.id) ?? note), ...patch })
    void data.patchNote(note.id, patch)
  }
  const back = meta.folderId ? `/app/notes/f/${meta.folderId}` : role === 'owner' ? '/app/notes/f/general' : '/app/notes'
  const presentIds = new Set(presence.present.map((p) => p.uid))
  const others = presence.present.filter((p) => p.uid !== data.myId)

  return (
    <div className="ct-notes-in flex h-full min-h-0 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-canvas px-3">
        <Link to={back} aria-label="Back" title="Back" className="grid size-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
          <ArrowLeft size={17} aria-hidden />
        </Link>
        {editor && <NoteToolbar editor={editor} zoom={zoom} onZoom={setZoom} disabled={!presence.canType} />}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className="flex -space-x-2">
            {others.slice(0, 4).map((p) => (
              <span key={p.uid} title={`${p.name} is here`} className="ct-animate-pop rounded-full ring-2 ring-canvas">
                <PersonAvatar person={{ handle: '', name: p.name, avatar_url: p.avatar }} className="size-7" />
              </span>
            ))}
          </div>
          {role === 'owner' && (
            <button type="button" onClick={() => setDialog('share')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-contrast hover:bg-accent-hover">
              <Share2 size={14} aria-hidden />Share
            </button>
          )}
          <ToggleBtn on={paper} label={paper ? 'Hide the page' : 'Show the page'} icon={paper ? FileText : Square} onClick={() => setPaper(!paper)} />
          <ToggleBtn on={panel} label={panel ? 'Hide details' : 'Show details'} icon={panel ? PanelRightClose : PanelRight} onClick={() => setPanel(!panel)} />
        </div>
      </div>

      {(presence.holder || role === 'viewer' || autoLinked) && (
        <div role="status" className="ct-notes-in flex shrink-0 items-center gap-2 border-b border-border bg-accent-soft px-4 py-1.5 text-[12.5px] text-fg">
          <Eye size={14} aria-hidden />
          {role === 'viewer' ? 'View only. You can read and copy this note.'
            : presence.holder ? `${presence.holder.name} is editing. You can type as soon as they are done; their changes appear here as they save.`
            : 'Filed under this class and week because it is class time. Change it in the details panel.'}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto transition-colors duration-300', paper ? 'bg-canvas' : 'bg-surface/40')}>
          <div style={{ zoom: zoom / 100 }}
            className={cn('mx-auto transition-[max-width,padding,box-shadow,margin] duration-300 ease-out',
              paper ? 'ct-note-paper my-8 min-h-[1056px] max-w-[816px] rounded-sm px-[88px] py-[72px] shadow-[0_2px_28px_rgba(0,0,0,0.28)]' : 'max-w-[760px] px-8 py-10')}>
            <input value={title} onChange={(e) => changeTitle(e.target.value)} readOnly={!presence.canType} maxLength={200}
              placeholder="Untitled note" aria-label="Title"
              className="mb-4 w-full bg-transparent font-display text-[32px] leading-tight font-semibold text-fg outline-none placeholder:text-subtle" />
            <EditorContent editor={editor} />
          </div>
        </div>
        <aside aria-label="Note details" className={cn('shrink-0 overflow-hidden border-l border-border bg-surface/50 transition-[width,opacity] duration-300 ease-out', panel ? 'w-80 opacity-100' : 'w-0 border-l-0 opacity-0')}>
          <div className="h-full w-80 overflow-y-auto">
            <NoteInfoPanel note={meta} title={title} onTitle={changeTitle} save={save.state} role={role} courses={allCourses}
              folders={data.folders} assessments={assessments} people={doc.people} presentIds={presentIds} onChange={changeMeta}
              onShare={() => setDialog('share')} onHistory={() => { void save.flush(); setDialog('history') }}
              onSaveTemplate={() => editor && setDialog({ template: editor.getJSON() })}
              onTrash={() => { void data.trash(note.id); navigate(back) }} />
          </div>
        </aside>
      </div>

      {dialog === 'history' && (
        <VersionHistory noteId={note.id} onClose={() => setDialog(null)} onRestore={(v) => {
          if (!presence.canType) return
          void updateNote(note.id, { title: v.title, content: v.content }).then(() => applyRemote({ ...note, title: v.title, content: v.content }))
          setDialog(null)
        }} />
      )}
      {dialog === 'share' && <ShareDialog kind="note" id={note.id} name={title || 'Untitled note'} onClose={() => { setDialog(null); doc.loadPeople() }} />}
      {dialog && typeof dialog === 'object' && (
        <SaveTemplateDialog onClose={() => setDialog(null)} onSave={async (name) => { await data.addTemplate(name, dialog.template); setDialog(null) }} />
      )}
    </div>
  )
}

function ToggleBtn({ on, label, icon: Icon, onClick }: { on: boolean; label: string; icon: typeof Eye; onClick: () => void }) {
  return (
    <button type="button" aria-pressed={on} aria-label={label} title={label} onClick={onClick}
      className={cn('grid size-8 place-items-center rounded-md transition-colors duration-150', on ? 'text-fg hover:bg-surface-2' : 'text-muted hover:bg-surface-2 hover:text-fg')}>
      <Icon size={16} aria-hidden />
    </button>
  )
}
