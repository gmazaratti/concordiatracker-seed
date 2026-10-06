import { useCallback, useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { NoteProvider } from '../collab/NoteProvider'
import { addComment, deleteComment, listComments, setThreadResolved, toThreads, type Thread } from './comments-api'
import type { Draft } from './CommentsPanel'

/**
 * Threads for one note: loaded, refreshed when anyone with the note open posts
 * (a broadcast ping on the note's channel), and pushed into the editor so the
 * highlights follow.
 */
export function useComments(noteId: string, provider: NoteProvider | null, editor: Editor | null) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)

  const load = useCallback(() => {
    listComments(noteId).then((rows) => setThreads(toThreads(rows))).catch(() => {})
  }, [noteId])

  useEffect(() => {
    load()
    if (!provider) return
    return provider.onComments(load)
  }, [load, provider])

  // Keep the editor's highlight plugin in step with the open threads.
  useEffect(() => {
    if (editor) syncHighlights(editor, threads, active, setActive)
  }, [editor, threads, active])

  const changed = () => {
    load()
    provider?.pingComments()
  }

  return {
    threads,
    active,
    setActive,
    draft,
    setDraft,
    postDraft: async (body: string) => {
      if (!draft) return
      const ok = await addComment({ noteId, threadId: draft.threadId, body, quote: draft.quote, anchor: draft.anchor })
      if (ok) {
        setActive(draft.threadId)
        setDraft(null)
        changed()
      }
    },
    reply: async (threadId: string, body: string) => {
      if (await addComment({ noteId, threadId, body })) changed()
    },
    resolve: async (threadId: string, resolved: boolean) => {
      if (await setThreadResolved(noteId, threadId, resolved)) changed()
    },
    remove: async (id: string) => {
      if (await deleteComment(id)) changed()
    },
  }
}

/** Hand the open threads to the editor's highlight plugin and repaint. Outside
 *  the hook on purpose: it writes into the editor's own storage object. */
function syncHighlights(editor: Editor, threads: Thread[], active: string | null, onSelect: (id: string) => void) {
  if (editor.isDestroyed) return
  const storage = (editor.storage as unknown as Record<string, { threads: unknown; active: unknown; onSelect: unknown } | undefined>).commentHighlights
  if (!storage) return
  storage.threads = threads.filter((t) => !t.resolved).map((t) => ({ id: t.id, anchor: t.anchor }))
  storage.active = active
  storage.onSelect = onSelect
  editor.view.dispatch(editor.state.tr.setMeta('ct-comments', true))
}
