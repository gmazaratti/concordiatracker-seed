import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { getSchema } from '@tiptap/core'
import { prosemirrorJSONToYDoc } from '@tiptap/y-tiptap'
import type { JSONContent } from '@tiptap/react'
import { NoteProvider } from './NoteProvider'
import { noteExtensions } from '../editor-extensions'

/**
 * Starts the live session for one note: load the log, convert an older note
 * into the shared document the first time anyone opens it, join the room.
 *
 * Created inside the effect (not during render) so React's double-mount in
 * development cannot leave a destroyed provider attached to the editor.
 *
 * `legacy` is set only for a viewer opening a note nobody has converted yet:
 * a viewer may not write the conversion, so they see the stored text, still
 * current, until an editor opens it once.
 */
export function useCollab(noteId: string, canEdit: boolean, content: JSONContent) {
  const [provider, setProvider] = useState<NoteProvider | null>(null)
  const [legacy, setLegacy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const p = new NoteProvider(noteId, canEdit)
    void (async () => {
      try {
        const has = await p.load()
        if (!has) {
          if (canEdit) {
            const schema = getSchema(noteExtensions())
            const seedDoc = prosemirrorJSONToYDoc(schema, content, 'default')
            const won = await p.seed(Y.encodeStateAsUpdate(seedDoc))
            if (!won) await p.load()
          } else if (alive) {
            setLegacy(true)
          }
        }
        void p.connect()
        if (alive) setProvider(p)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      p.destroy()
    }
    // The stored JSON only matters for the one-time conversion at open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, canEdit])

  return { provider, legacy, failed }
}
