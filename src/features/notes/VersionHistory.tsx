import { useEffect, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { RotateCcw } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { listVersions } from './notes-api'
import type { NoteVersion } from './types'

const EXTENSIONS = [StarterKit, TaskList, TaskItem]

/**
 * Earlier states of a note, newest first, written by the database (one per ten
 * minutes of editing, last 50 kept). Restoring is just another edit, so the
 * state being replaced becomes a version itself and the restore can be undone
 * from this same list.
 */
export function VersionHistory({
  noteId,
  onRestore,
  onClose,
}: {
  noteId: string
  onRestore: (v: NoteVersion) => void
  onClose: () => void
}) {
  const [versions, setVersions] = useState<NoteVersion[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    listVersions(noteId)
      .then((v) => {
        setVersions(v)
        setPicked(v[0]?.id ?? null)
      })
      .catch(() => setFailed(true))
  }, [noteId])

  const current = versions?.find((v) => v.id === picked) ?? null
  return (
    <ModalShell label="Version history" onClose={onClose} widthClass="sm:max-w-3xl" scroll={false}>
      <div className="flex max-h-[80vh] min-h-[22rem] flex-col sm:flex-row">
        <div className="shrink-0 border-b border-border p-3 sm:w-56 sm:overflow-y-auto sm:border-r sm:border-b-0">
          <h2 className="px-1 pb-2 text-[15px] font-semibold text-fg">Version history</h2>
          {failed && <p className="px-1 text-[13px] text-danger">History could not be loaded.</p>}
          {versions?.length === 0 && (
            <p className="px-1 text-[13px] text-subtle">
              No earlier versions yet. One is kept for every ten minutes of editing.
            </p>
          )}
          <ul className="flex gap-1 overflow-x-auto sm:flex-col">
            {versions?.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => setPicked(v.id)}
                  className={cn(
                    'w-full rounded-lg px-2.5 py-2 text-left text-[13px] whitespace-nowrap',
                    v.id === picked ? 'bg-accent-soft text-fg' : 'text-muted hover:bg-surface-2',
                  )}
                >
                  {new Date(v.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {current ? (
              <>
                <p className="mb-3 text-[18px] font-semibold text-fg">{current.title || 'Untitled note'}</p>
                <Preview key={current.id} version={current} />
              </>
            ) : (
              !failed && versions === null && <div className="ct-shimmer h-40 rounded-lg" />
            )}
          </div>
          {current && (
            <div className="flex justify-end border-t border-border p-3">
              <Button onClick={() => onRestore(current)}>
                <RotateCcw size={15} aria-hidden />
                Restore this version
              </Button>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}

/** A read-only editor, not raw HTML: the stored document goes back through the
 *  same schema the editor uses, so nothing in it can render as markup. */
function Preview({ version }: { version: NoteVersion }) {
  const editor = useEditor({
    editable: false,
    extensions: EXTENSIONS,
    content: version.content,
    editorProps: { attributes: { class: 'ct-note-doc' } },
  })
  return <EditorContent editor={editor} />
}
