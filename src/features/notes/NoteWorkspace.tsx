import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from '@tiptap/react'
import * as Y from 'yjs'
import { absolutePositionToRelativePosition, ySyncPluginKey } from '@tiptap/y-tiptap'
import { BookOpenCheck, Eye, FileType2, ListChecks } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { HoverTips } from '@/components/ui/HoverTips'
import { cn } from '@/lib/cn'
import { loadNoteFonts, noteExtensions, personColor } from './editor-extensions'
import { NoteToolbar } from './NoteToolbar'
import { NoteTopBar } from './NoteTopBar'
import { NotePaper } from './NotePaper'
import { NoteSidePanel, type SideTab } from './NoteSidePanel'
import { NoteDialogs, type DialogState } from './NoteDialogs'
import { SlidesPanel } from './SlidesPanel'
import { TaskBar } from './TaskBar'
import { MarginComments } from './comments/MarginComments'
import { FilePanel } from './files/FilePanel'
import { FileLinkPicker } from './files/FileLinkPicker'
import { fileLinkKey, insertFileLink, usePlaceOf } from './files/file-links'
import { useAutosave } from './useAutosave'
import { useNotesData } from './useNotesData'
import { useLocalPref } from './useLocalPref'
import { useNoteInserts } from './useNoteInserts'
import { useNoteTask } from './useNoteTask'
import { useComments } from './comments/useComments'
import { useLiveMeta } from './collab/useLiveMeta'
import { useAnnounceMe, useLivePeople } from './collab/useLivePeople'
import { cleanPastedHtml } from './paste-clean'
import { LiveMentionSource } from './mentions/mention-source'
import { FILE_ACCEPT } from './media/note-files'
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
  const [tab, setTab] = useState<SideTab>('details')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [status, setStatus] = useState<SaveStatus>(provider.status)
  const [pages, setPages] = useState(1)
  const [today] = useState(() => new Date().toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }))
  const [paper, setPaper] = useState<HTMLDivElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const [fileKey, setFileKey] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const openFileRef = useRef<(key: string) => void>(() => {})
  const placeOf = usePlaceOf()
  const [mentionSource] = useState(() => new LiveMentionSource(note.id))
  const canEdit = (role === 'owner' || role === 'editor') && !legacy
  const allCourses = useMemo(() => [...courses, ...pastCourses], [courses, pastCourses])
  const live = useLiveMeta(provider, { title: note.title, page: readPage(note.page) })
  const here = useLivePeople(provider)
  const save = useAutosave(note.id, () => { touchNote(note.id, true); loadPeople() })
  const me = useMemo(() => ({ uid: data.myId ?? 'me', name: user.name || 'You', avatar: user.avatarUrl ?? null, color: personColor(data.myId ?? 'me') }), [data.myId, user.name, user.avatarUrl])
  const { actions: insertActions, imageInput, fileInput, onImages, onFiles, onVoice } = useNoteInserts(note.id, editorRef, () => setDialog('voice'))
  const task = useNoteTask(note.id, live.title)
  useAnnounceMe(provider, me)

  useEffect(() => { mentionSource.update(people, data.myId) }, [mentionSource, people, data.myId])
  useEffect(() => { loadNoteFonts() }, [])
  useEffect(() => provider.onStatus(setStatus), [provider])
  // The tab says which note this is.
  useEffect(() => { document.title = `${live.title.trim() || 'Untitled note'} - ConcordiaTracker` }, [live.title])

  const editor = useEditor({
    extensions: legacy
      ? noteExtensions()
      : noteExtensions({
          placeholder: 'Start writing…  # for a heading, [ ] for a checklist, @ for a person or a date',
          collab: { doc: provider.doc, awareness: provider.awareness, user: me },
          mentions: mentionSource,
        }),
    ...(legacy ? { content: note.content } : {}),
    editable: canEdit,
    editorProps: {
      attributes: { class: 'ct-note-doc', 'aria-label': 'Note' },
      transformPastedHTML: cleanPastedHtml,
      handlePaste: (_v, e): boolean => onImages([...(e.clipboardData?.files ?? [])]),
      handleDrop: (_v, e): boolean => onImages([...((e as DragEvent).dataTransfer?.files ?? [])]),
      // A link to one of your files opens it beside the note instead of leaving it.
      handleClick: (_v, _pos, e): boolean => {
        const key = fileLinkKey(e.target)
        if (!key) return false
        e.preventDefault()
        openFileRef.current(key)
        return true
      },
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
  useEffect(() => {
    openFileRef.current = (key) => { setFileKey(key); setTab('file'); setPanel(true) }
  }, [setPanel])
  // Real page breaks only in the Pages layout; the extension reports the page count.
  useEffect(() => {
    if (!editor) return
    configurePagination(editor, live.page.layout === 'pages', setPages)
  }, [editor, live.page.layout])

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
  const back = task.task ? '/app/notes/f/tasks' : meta.folderId ? `/app/notes/f/${meta.folderId}` : role === 'owner' ? '/app/notes/f/general' : '/app/notes'
  const others = here.filter((h) => h.uid !== me.uid && h.uid !== 'me')
  const liveColors = useMemo(() => new Map(here.map((h) => [h.uid, h.status ?? 'active'] as const)), [here])
  const lastEditor = useMemo(() => {
    const p = [...people].filter((x) => x.lastEditedAt).sort((a, b) => (b.lastEditedAt ?? '').localeCompare(a.lastEditedAt ?? ''))[0]
    return p ? { id: p.userId, name: p.name, handle: p.handle, avatar: p.avatarUrl } : null
  }, [people])
  const json = () => (editor?.getJSON() ?? note.content) as JSONContent

  return (
    <div className="ct-notes-in flex h-full min-h-0 flex-col">
      <HoverTips />
      <NoteTopBar back={back} title={live.title} onTitle={changeTitle} canEdit={canEdit} role={role} status={status} here={others}
        canComment={sel && !legacy} onComment={startComment} onShare={() => setDialog('share')} onPageSetup={() => setDialog('page')}
        onExport={() => editor && setDialog({ pdf: editor.getJSON() })} onHistory={() => setDialog({ history: json() })}
        onTemplate={() => editor && setDialog({ template: editor.getJSON() as JSONContent })}
        onTrash={() => { void data.trash(note.id); navigate(back) }} panel={panel} onPanel={() => setPanel(!panel)}
        extra={[
          { id: 'word', label: 'Export to Word or Google Docs', icon: FileType2, onSelect: () => setDialog({ export: json() }) },
          { id: 'study', label: 'Study: flashcards and quiz', icon: BookOpenCheck, onSelect: () => setDialog({ study: json() }) },
          ...(role === 'owner' && !task.task ? [{ id: 'task', label: 'Make this a task', icon: ListChecks, onSelect: task.make }] : []),
        ]} />

      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-canvas px-3">
        {editor && <NoteToolbar editor={editor} zoom={zoom} onZoom={setZoom} disabled={!canEdit} insert={{ ...insertActions, linkFile: () => setLinking(true) }} />}
        <input ref={imageInput} type="file" accept="image/*" multiple hidden
          onChange={(e) => { onImages([...(e.target.files ?? [])]); e.target.value = '' }} />
        <input ref={fileInput} type="file" accept={FILE_ACCEPT} multiple hidden
          onChange={(e) => { onFiles([...(e.target.files ?? [])]); e.target.value = '' }} />
      </div>

      {task.task && <TaskBar task={task.task} onToggle={task.toggle} onDue={task.setDue} onRemove={task.unlink} />}
      {(role === 'viewer' || legacy) && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-border bg-accent-soft px-4 py-1.5 text-[12.5px] text-fg">
          <Eye size={14} aria-hidden />
          {role === 'viewer' ? 'View only. You can read, copy and comment.' : 'Showing the saved copy. It turns live the first time an editor opens it.'}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className={cn('min-h-0 min-w-0 flex-1 overflow-auto', live.page.layout === 'pages' ? 'bg-canvas' : 'bg-surface/30')}>
          <NotePaper setup={live.page} zoom={zoom} pages={pages} paperRef={setPaper} title={live.title} date={today}
            overlay={editor && !legacy && (
              <MarginComments editor={editor} paper={paper} canComment={sel} onAdd={startComment} activeId={comments.active}
                onOpen={(id) => { comments.setActive(id); setPanel(true); setTab('comments') }} />
            )}>
            <EditorContent editor={editor} />
          </NotePaper>
        </div>
        <NoteSidePanel open={panel} tab={tab} onTab={setTab} commentCount={comments.threads.filter((t) => !t.resolved).length}
          details={{ note: meta, role, courses: allCourses, folders: data.folders, assessments, people, live: liveColors, onChange: changeMeta, onShare: () => setDialog('share') }}
          comments={{ threads: comments.threads, people, myId: data.myId, role, active: comments.active, draft: comments.draft,
            onActive: comments.setActive, onPostDraft: (b) => void comments.postDraft(b), onCancelDraft: () => comments.setDraft(null),
            onReply: (t, b) => void comments.reply(t, b), onResolve: (t, r) => void comments.resolve(t, r), onDelete: (id) => void comments.remove(id) }}
          slides={<SlidesPanel provider={provider} noteId={note.id} canEdit={canEdit} />}
          file={fileKey ? <FilePanel fileKey={fileKey} onClose={() => { setFileKey(null); setTab('details') }} /> : null} />
      </div>

      <NoteDialogs state={dialog} onClose={() => setDialog(null)} noteId={note.id} title={live.title} page={live.page} canEdit={canEdit} editor={lastEditor}
        onPage={(p) => { live.writePage(p); void data.patchNote(note.id, { page: p }) }}
        onRestore={(content) => editor?.commands.setContent(content)} onTemplate={(name, c) => data.addTemplate(name, c)} onShared={loadPeople}
        onVoice={onVoice} />
      {linking && (
        <FileLinkPicker placeOf={placeOf} onClose={() => setLinking(false)}
          onPick={(f) => { if (editor) insertFileLink(editor, f); setLinking(false) }} />
      )}
    </div>
  )
}

/** Hand the layout to the pagination extension. Outside the component: it
 *  writes into the editor's own storage object. */
function configurePagination(editor: Editor, enabled: boolean, onPages: (n: number) => void) {
  const s = (editor.storage as unknown as Record<string, { enabled: boolean; onPages: (n: number) => void; refresh: () => void } | undefined>).pagination
  if (!s) return
  s.enabled = enabled
  s.onPages = onPages
  s.refresh()
  if (!enabled) onPages(1)
}
