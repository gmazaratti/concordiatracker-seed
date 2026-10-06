import type { Editor } from '@tiptap/react'
import { reportWriteError } from '@/lib/write-errors'
import { uploadNoteImage } from './note-media'

/**
 * Put images into a note — from the toolbar button, a paste or a drop. A
 * placeholder-free approach: each upload is inserted where the cursor is
 * when it finishes, and a failure says why instead of leaving a broken box.
 *
 * Returns true when it handled the event (there were image files), so the
 * editor does not also try to paste them as text.
 */
export function insertImages(noteId: string, files: File[], getEditor: () => Editor | null): boolean {
  const images = files.filter((f) => f.type.startsWith('image/'))
  if (images.length === 0) return false
  void (async () => {
    for (const file of images) {
      try {
        const { path, width, height } = await uploadNoteImage(noteId, file)
        const editor = getEditor()
        if (!editor || editor.isDestroyed) return
        editor.chain().focus().insertContent({ type: 'image', attrs: { path, width, height, alt: file.name.replace(/\.[^.]+$/, '') } }).run()
      } catch (e) {
        reportWriteError('The image was not added', e instanceof Error ? e.message : 'Try again.')
      }
    }
  })()
  return true
}
