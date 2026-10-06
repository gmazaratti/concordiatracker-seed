import { useCallback, useMemo } from 'react'
import type { Editor } from '@tiptap/react'
import { useAppData } from '@/app/providers/app-data'
import { useNotesData } from '../useNotesData'
import type { NoteFile } from './files-api'

/**
 * Links from a note to a file. The link is an ordinary link to an in-app
 * address, `/app/notes/file/<key>`: inside the note a click opens the file
 * beside the page, and the same address opened on its own (a new tab, a
 * copied link) shows the file full screen. A key is `f:<uuid>` (a folder file)
 * or `c:<uuid>` (a syllabus), and access is decided by the database each time,
 * so a link only ever opens for someone already allowed to read the file.
 */
export const FILE_LINK_PREFIX = '/app/notes/file/'

const KEY_RE = /^[fc]:[0-9a-f-]{36}$/i

export const fileHref = (f: Pick<NoteFile, 'key'>) => `${FILE_LINK_PREFIX}${encodeURIComponent(f.key)}`

/** The file key a click landed on, or null when it was not a file link. */
export function fileLinkKey(target: EventTarget | null): string | null {
  const el = target instanceof Element ? target.closest('a[href]') : null
  const href = el?.getAttribute('href') ?? ''
  if (!href.startsWith(FILE_LINK_PREFIX)) return null
  const key = decodeURIComponent(href.slice(FILE_LINK_PREFIX.length))
  return KEY_RE.test(key) ? key : null
}

export const isFileKey = (key: string) => KEY_RE.test(key)

/** Link the selected words to the file, or, with nothing selected, insert the file's name as the link. */
export function insertFileLink(editor: Editor, f: NoteFile) {
  const href = fileHref(f)
  const { from, to } = editor.state.selection
  if (from !== to) {
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
    return
  }
  editor
    .chain()
    .focus()
    .insertContent([
      { type: 'text', text: f.name, marks: [{ type: 'link', attrs: { href } }] },
      { type: 'text', text: ' ' },
    ])
    .run()
}

/** Where a file lives, in words: "COMP 248 · Syllabus", a folder name, or General. */
export function usePlaceOf() {
  const { courses, pastCourses } = useAppData()
  const data = useNotesData()
  const codes = useMemo(() => new Map([...courses, ...pastCourses].map((c) => [c.id, c.code || c.title])), [courses, pastCourses])
  const folders = useMemo(() => new Map(data.folders.map((f) => [f.id, f])), [data.folders])
  return useCallback(
    (f: NoteFile) => {
      if (f.source === 'course') return `${codes.get(f.courseId ?? '') ?? 'Course'} · Syllabus`
      if (!f.folderId) return 'General'
      const folder = folders.get(f.folderId)
      if (!folder) return 'Shared folder'
      return folder.courseId ? (codes.get(folder.courseId) ?? folder.name) : folder.name
    },
    [codes, folders],
  )
}
