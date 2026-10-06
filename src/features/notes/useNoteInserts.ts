import { useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { reportWriteError } from '@/lib/write-errors'
import { insertImages } from './media/insert-images'
import { uploadNoteFile } from './media/note-files'
import { armDrawingOpen } from './drawing/drawing-model'
import { armDateChipOpen } from './mentions/chip-state'
import type { InsertActions } from './NoteToolbar'

/**
 * Everything the toolbar's Insert menu can put into a note, plus the hidden
 * file inputs it needs. Uploads are inserted where the cursor is when they
 * finish, and a failure says why instead of leaving a broken box.
 */
export function useNoteInserts(noteId: string, editorRef: React.RefObject<Editor | null>, openVoice: () => void) {
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const addFile = async (file: Blob, name: string, durationMs?: number) => {
    try {
      const { path, size, mime } = await uploadNoteFile(noteId, file)
      const ed = editorRef.current
      if (!ed || ed.isDestroyed) return
      ed.chain().focus().insertContent({ type: 'noteFile', attrs: { path, name: name.slice(0, 160), size, mime, durationMs: durationMs ?? null } }).run()
    } catch (e) {
      reportWriteError('The file was not added', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const actions: InsertActions = {
    image: () => imageInput.current?.click(),
    file: () => fileInput.current?.click(),
    voice: openVoice,
    drawing: () => {
      armDrawingOpen()
      editorRef.current?.chain().focus().insertContent({ type: 'noteDrawing' }).run()
    },
    date: () => {
      const d = new Date()
      d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
      armDateChipOpen()
      editorRef.current?.chain().focus().insertContent([{ type: 'noteDate', attrs: { iso: d.toISOString() } }, { type: 'text', text: ' ' }]).run()
    },
    // Typing "@" opens the mention menu; the button just types it for you.
    mention: () => editorRef.current?.chain().focus().insertContent('@').run(),
  }

  const onImages = (files: File[]) => insertImages(noteId, files, () => editorRef.current)
  const onFiles = (files: File[]) => { for (const f of files) void addFile(f, f.name) }
  const onVoice = (blob: Blob, ms: number) => void addFile(blob, 'Voice note', ms)

  return { actions, imageInput, fileInput, onImages, onFiles, onVoice }
}
