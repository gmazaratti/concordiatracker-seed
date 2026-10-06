import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import * as Y from 'yjs'
import { absolutePositionToRelativePosition, ySyncPluginKey } from '@tiptap/y-tiptap'
import { Eye } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { cn } from '@/lib/cn'
import { loadNoteFonts, noteExtensions, personColor } from './editor-extensions'
import { NoteToolbar } from './NoteToolbar'
import { NoteTopBar } from './NoteTopBar'
import { NotePaper } from './NotePaper'
import { NoteSidePanel } from './NoteSidePanel'
import { NoteDialogs, type DialogState } from './NoteDialogs'
import { useAutosave } from './useAutosave'
import { useNotesData } from './useNotesData'
import { useLocalPref } from './useLocalPref'
import { useComments } from './comments/useComments'
import { useLiveMeta } from './collab/useLiveMeta'
import { useLivePeople } from './collab/useLivePeople'
import { insertImages } from './media/insert-images'
import { readPage } from './page-setup'
import { touchNote, type NotePerson } from './sharing-api'
import type { NoteProvider, SaveStatus } from './collab/NoteProvider'
import type { Note, NoteMeta, NoteRole } from './types'

/** The open note: top bar, toolbar, the page, and the side panel. */
export function NoteWorkspace({ note, role, provider, legacy, people, loadPeople }: {
  note: Note
  role: NoteRole
  provider: NoteProvider
  legacy: boolean
  people: NotePerson[]
  loadPeople: () => void
}) {
  const navigate = useNavigate()
  const { courses, pastCourses, assessments, user } = useAppData()
  const data = useNotesData()
  const [meta, setMeta] = useState<NoteMeta>(note)
  const [zoom, setZoom] = useLocalPref('ct_notes_zoom', 100)
  const [panel, setPanel] = useLocalPref('ct_notes_panel', true)
  const [tab, setTab] = useState<'details' | 'comments'>('details')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [status, setStatus] = useState<SaveStatus>(provider.status)
  const fileInput = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const canEdit = (role === 'owner' || role === 'editor') && !legacy
  const allCourses = useMemo(() => [...courses, ...pastCourses], [courses, pastCourses])
  const live = useLiveMeta(provider, { title: note.title, page: readPage(note.page) })
  const here = useLivePeople(provider)
  const save = useAutosave(note.id, () => { touchNote(note.id, true); loadPeople() })
  const me = useMemo(() => ({ uid: data.myId ?? 'me', name: user.name || 'You', avatar: user.avatarUrl ?? null, color: personColor(data.myId ?? 'me') }), [data.myId, user.name, user.avatarUrl])

  useEffect(() => { loadNoteFonts() }, [])
  useEffect(() => provider.onStatus(setStatus), [provider])

  const editor = useEditor({
    extensions: legacy
      ? noteExtensions()
      : noteExtensions({ placeholder: 'Start writing…  # for a heading, - for a list, [ ] for a checklist', collab: { doc: provider.doc, awareness: provider.awareness, user: me } }),
    ...(legacy ? { content: note.content } : {}),
    editable: canEdit,
    editorProps: {
      attributes: { class: 'ct-note-doc', 'aria-label': 'Note' },
      handlePaste: (_v, e): boolean => insertImages(note.id, [...(e.clipboardData?.files ?? [])], () => editorRef.current),
      handleDrop: (_v, e): boolean => insertImages(note.id, [...((e as DragEvent).dataTransfer?.files ?? [])], () => editorRef.current),
    },
    // Only MY changes refresh the searchable copy; a classmate's edits are
    // saved by them, so every client writing the same thing is avoided.
    onUpdate: ({ editor: e, transaction }) => {
      const remote = (transaction.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin
      if (remote || !canEdit) return
      save.queue({ content: e.getJSON(), bodyText: e.getText({ blockSeparator: '\n' }) })
    },
  }, [provider, legacy])

  useEffect(() => { editorRef.current = editor }, [editor])
  const comments = useComments(note.id, provider, editor)
  const sel = useEditorState({ editor, selector: ({ editor: e }) => !!e && !e.state.selection.empty })

  const startComment = () => {
    if (!editor) return
    const { from, to } = editor.state.selection
    if (from === to) return
    const binding = (ySyncPluginKey.getState(editor.state) as { binding?: { type: Y.XmlFragment; mapping: never } } | undefined)?.binding
    const anchor = binding
      ? {
          from: Y.relativePositionToJSON(absolutePositionToRelativePosition(from, binding.type, binding.mapping)),
          to: Y.relativePositionToJSON(absolutePositionToRelativePosition(to, binding.type, binding.mapping)),
        }
      : null
    comments.setDraft({ threadId: crypto.randomUUID(), quote: editor.state.doc.textBetween(from, to, ' ').slice(0, 500), anchor })
    setPanel(true)
    setTab('comments')
  }
  const changeMeta = (patch: Partial<NoteMeta>) => {
    setMeta((m) => ({ ...m, ...patch }))
    void data.patchNote(note.id, patch)
  }
  const changeTitle = (v: string) => {
    if (!canEdit) return
    live.writeTitle(v)
    save.queue({ title: v })
    data.patchLocal(note.id, { title: v })
  }
  const back = meta.folderId ? `/app/notes/f/${meta.folderId}` : role === 'owner' ? '/app/notes/f/general' : '/app/notes'
  const others = here.filter((h) => h.uid !== me.uid)
  const liveColors = useMemo(() => new Map(here.map((h) => [h.uid, h.color])), [here])

  return (
    <div className="ct-notes-in flex h-full min-h-0 flex-col">
      <NoteTopBar back={back} title={live.title} onTitle={changeTitle} canEdit={canEdit} role={role} status={status} here={others}
        canComment={sel && !legacy} onComment={startComment} onShare={() => setDialog('share')} onPageSetup={() => setDialog('page')}
        onExport={() => editor && setDialog({ pdf: editor.getJSON() })} onHistory={() => setDialog('history')}
        onTemplate={() => editor && setDialog({ template: editor.getJSON() as JSONContent })}
        onTrash={() => { void data.trash(note.id); navigate(back) }} panel={panel} onPanel={() => setPanel(!panel)} />

      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-canvas px-3">
        {editor && <NoteToolbar editor={editor} zoom={zoom} onZoom={setZoom} disabled={!canEdit} onImage={() => fileInput.current?.click()} />}
        <input ref={fileInput} type="file" accept="image/*" multiple hidden
          onChange={(e) => { insertImages(note.id, [...(e.target.files ?? [])], () => editorRef.current); e.target.value = '' }} />
      </div>

      {(role === 'viewer' || legacy) && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-border bg-accent-soft px-4 py-1.5 text-[12.5px] text-fg">
          <Eye size={14} aria-hidden />
          {role === 'viewer' ? 'View only. You can read, copy and comment.' : 'Showing the saved copy. It turns live the first time an editor opens it.'}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto', live.page.layout === 'pages' ? 'bg-canvas' : 'bg-surface/30')}>
          <NotePaper setup={live.page} zoom={zoom}>
            <EditorContent editor={editor} />
          </NotePaper>
        </div>
        <NoteSidePanel open={panel} tab={tab} onTab={setTab} commentCount={comments.threads.filter((t) => !t.resolved).length}
          details={{ note: meta, role, courses: allCourses, folders: data.folders, assessments, people, live: liveColors, onChange: changeMeta, onShare: () => setDialog('share') }}
          comments={{ threads: comments.threads, people, myId: data.myId, role, active: comments.active, draft: comments.draft,
            onActive: comments.setActive, onPostDraft: (b) => void comments.postDraft(b), onCancelDraft: () => comments.setDraft(null),
            onReply: (t, b) => void comments.reply(t, b), onResolve: (t, r) => void comments.resolve(t, r), onDelete: (id) => void comments.remove(id) }} />
      </div>

      <NoteDialogs state={dialog} onClose={() => setDialog(null)} noteId={note.id} title={live.title} page={live.page} canEdit={canEdit}
        onPage={(p) => { live.writePage(p); void data.patchNote(note.id, { page: p }) }}
        onRestore={(content) => editor?.commands.setContent(content)} onTemplate={(name, c) => data.addTemplate(name, c)} onShared={loadPeople} />
    </div>
  )
}
