import type { JSONContent } from '@tiptap/react'

/** A note as the list shows it: everything except the document itself, so a
 *  list of two hundred notes does not download two hundred documents. */
export interface NoteMeta {
  id: string
  /** Who owns it. Not me means it was shared with me. */
  ownerId: string
  title: string
  folderId: string | null
  /** courses.id, which is TEXT ("manual-course-1"), not a uuid. */
  courseId: string | null
  week: number | null
  lectureDate: string | null
  assignmentIds: string[]
  pinned: boolean
  /** The first lines of the note, for cards. Written by the database. */
  excerpt: string
  createdAt: string
  updatedAt: string
}

export interface Note extends NoteMeta {
  content: JSONContent
}

/** A folder. A CLASS is a folder too: `courseId` is set and its name follows
 *  the course code. Folders nest through `parentId`. */
export interface NoteFolder {
  id: string
  name: string
  parentId: string | null
  position: number
  courseId: string | null
  icon: string
  color: string
  pinned: boolean
  /** Set when the folder is someone else's, shared with me. */
  sharedRole?: 'viewer' | 'editor'
}

export type NoteRole = 'owner' | 'editor' | 'viewer'

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

