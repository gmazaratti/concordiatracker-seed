import type { JSONContent } from '@tiptap/react'

/** A note as the list shows it: everything except the document itself, so a
 *  list of two hundred notes does not download two hundred documents. */
export interface NoteMeta {
  id: string
  title: string
  folderId: string | null
  /** courses.id, which is TEXT ("manual-course-1"), not a uuid. */
  courseId: string | null
  week: number | null
  lectureDate: string | null
  assignmentIds: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export interface Note extends NoteMeta {
  content: JSONContent
}

export interface NoteFolder {
  id: string
  name: string
  parentId: string | null
  position: number
}

export interface NoteVersion {
  id: string
  title: string
  content: JSONContent
  createdAt: string
}

export interface NoteTemplate {
  id: string
  name: string
  content: JSONContent
  /** Built-in templates ship in code and cannot be deleted. */
  builtIn: boolean
}

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [] }

/** Which notes the list is showing. */
export type NotesFilter =
  | { kind: 'all' }
  | { kind: 'general' }
  | { kind: 'course'; courseId: string }
  | { kind: 'folder'; folderId: string }
