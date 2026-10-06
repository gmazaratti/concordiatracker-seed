import { useEffect, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { Placeholder } from '@tiptap/extensions'
import { Check, CloudOff, Loader2 } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { getNote } from './notes-api'
import { EditorToolbar } from './EditorToolbar'
import { NoteMetaBar } from './NoteMetaBar'
import { useAutosave, type SaveState } from './useAutosave'
import type { Note, NoteFolder, NoteMeta } from './types'
import { opened } from './opened-cache'


export function NoteEditor(props: {
  noteId: string
  courses: Course[]
  folders: NoteFolder[]
  assessments: Assessment[]
  onMeta: (id: string, patch: Partial<NoteMeta>, persist: boolean) => void
  onHistory: () => void
  onSaveTemplate: (content: JSONContent) => void
  onTrash: () => void
}) {
  const [note, setNote] = useState<Note | null>(() => opened.get(props.noteId) ?? null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    getNote(props.noteId)
      .then((n) => {
        if (cancelled) return
        if (!n) return setMissing(true)
        // Only take the server copy if nothing newer is on screen.
        const local = opened.get(props.noteId)
        if (!local || local.updatedAt <= n.updatedAt) {
          opened.set(n.id, n)
          setNote(n)
        }
      })
      .catch(() => {
        if (!cancelled && !opened.get(props.noteId)) setMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [props.noteId])

  if (missing) return <p className="p-8 text-[14px] text-muted">This note could not be opened. It may have been deleted.</p>
  if (!note) return <EditorSkeleton />
  // Keyed: a different note is a different editor, with its own undo history.
  return <LoadedEditor key={note.id} note={note} {...props} />
}

function LoadedEditor({
  note,
  courses,
  folders,
  assessments,
  onMeta,
  onHistory,
  onSaveTemplate,
  onTrash,
}: Parameters<typeof NoteEditor>[0] & { note: Note }) {
  const [title, setTitle] = useState(note.title)
  const [meta, setMeta] = useState<NoteMeta>(note)
  const save = useAutosave(note.id, (p) => {
    if (p.title !== undefined) onMeta(note.id, { title: p.title }, false)
  })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: true, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Start writing…  Type # for a heading, - for a list, [ ] for a checklist.' }),
    ],
    content: note.content,
    editorProps: { attributes: { class: 'ct-note-doc', 'aria-label': 'Note' } },
    onUpdate: ({ editor: e }) => {
      const content = e.getJSON()
      // useEditor captures this callback once, so read the latest copy from the
      // cache rather than from title/meta, which would be the first render's.
      opened.set(note.id, { ...(opened.get(note.id) ?? note), content, updatedAt: new Date().toISOString() })
      save.queue({ content, bodyText: e.getText({ blockSeparator: '\n' }) })
      onMeta(note.id, { updatedAt: new Date().toISOString() }, false)
    },
  })

  const changeTitle = (v: string) => {
    setTitle(v)
    opened.set(note.id, { ...(opened.get(note.id) ?? note), title: v })
    save.queue({ title: v })
    onMeta(note.id, { title: v }, false)
  }

  const changeMeta = (patch: Partial<NoteMeta>) => {
    setMeta((m) => ({ ...m, ...patch }))
    opened.set(note.id, { ...(opened.get(note.id) ?? note), ...patch })
    onMeta(note.id, patch, true)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {editor && <EditorToolbar editor={editor} />}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-start gap-3 px-6 pt-6">
            <input
              value={title}
              onChange={(e) => changeTitle(e.target.value)}
              maxLength={200}
              placeholder="Untitled note"
              aria-label="Title"
              className="min-w-0 flex-1 bg-transparent font-display text-[28px] leading-tight font-semibold text-fg outline-none placeholder:text-subtle"
            />
            <SaveBadge state={save.state} />
          </div>
          <NoteMetaBar
            note={meta}
            courses={courses}
            folders={folders}
            assessments={assessments}
            onChange={changeMeta}
            onHistory={() => {
              void save.flush()
              onHistory()
            }}
            onSaveTemplate={() => editor && onSaveTemplate(editor.getJSON())}
            onTrash={onTrash}
          />
          <EditorContent editor={editor} className="px-6 pb-24" />
        </div>
      </div>
    </div>
  )
}

function SaveBadge({ state }: { state: SaveState }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const [icon, text] =
    state === 'error'
      ? [<CloudOff key="e" size={13} aria-hidden />, 'Not saved']
      : state === 'saved'
        ? [<Check key="s" size={13} aria-hidden />, offline ? 'Saved on this device' : 'Saved']
        : [<Loader2 key="p" size={13} className="animate-spin" aria-hidden />, 'Saving']
  return (
    <span
      role="status"
      className={`mt-2.5 inline-flex shrink-0 items-center gap-1 text-[12px] ${state === 'error' ? 'text-danger' : 'text-subtle'}`}
    >
      {icon}
      {text}
    </span>
  )
}

function EditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 px-6 pt-16" aria-busy="true">
      <div className="ct-shimmer h-8 w-2/3 rounded-lg" />
      <div className="ct-shimmer h-4 w-full rounded" />
      <div className="ct-shimmer h-4 w-5/6 rounded" />
      <div className="ct-shimmer h-4 w-4/6 rounded" />
    </div>
  )
}
