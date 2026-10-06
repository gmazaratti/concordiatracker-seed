import type { JSONContent } from '@tiptap/react'
import { supabase } from '@/lib/supabase'
import { reportWriteError, writeErrorText } from '@/lib/write-errors'
import type { Note, NoteFolder, NoteMeta, NoteTemplate, NoteVersion } from './types'

/**
 * Every read and write the Notes feature makes. Row-level security does the
 * gatekeeping (db/notes.sql): each call here simply asks, and the database only
 * ever answers with the caller's own notes.
 *
 * Writes REPORT their failures (write-errors) rather than swallowing them. A
 * note that silently did not save is the worst thing this feature could do.
 * Offline writes are queued by the client's offline layer and answered with a
 * stand-in success, so "saved" offline means "saved on this device".
 */

const META_COLS = 'id,user_id,title,folder_id,course_id,week,lecture_date,assignment_ids,pinned,excerpt,created_at,updated_at'

interface NoteRow {
  id: string
  user_id: string
  title: string
  folder_id: string | null
  course_id: string | null
  week: number | null
  lecture_date: string | null
  assignment_ids: string[] | null
  pinned: boolean
  excerpt?: string | null
  created_at: string
  updated_at: string
  content?: JSONContent
}

function toMeta(r: NoteRow): NoteMeta {
  return {
    id: r.id,
    ownerId: r.user_id,
    title: r.title,
    folderId: r.folder_id,
    courseId: r.course_id,
    week: r.week,
    lectureDate: r.lecture_date,
    assignmentIds: r.assignment_ids ?? [],
    pinned: r.pinned,
    excerpt: r.excerpt ?? '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export async function listNotes(): Promise<NoteMeta[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(META_COLS)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1000)
  if (error) throw error
  return ((data ?? []) as NoteRow[]).map(toMeta)
}

/** Notes inside one folder, mine or shared with me (RLS decides). */
export async function listFolderNotes(folderId: string): Promise<NoteMeta[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(META_COLS)
    .eq('folder_id', folderId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as NoteRow[]).map(toMeta)
}

export async function listCourseNotes(courseId: string): Promise<NoteMeta[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(META_COLS)
    .eq('course_id', courseId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as NoteRow[]).map(toMeta)
}

export async function getNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase.from('notes').select(`${META_COLS},content`).eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as NoteRow
  return { ...toMeta(row), content: row.content ?? { type: 'doc', content: [] } }
}

export interface NewNote {
  title?: string
  content?: JSONContent
  bodyText?: string
  folderId?: string | null
  courseId?: string | null
  week?: number | null
  lectureDate?: string | null
}

/** The id is chosen HERE so the editor can open the note at once, and so a
 *  note written offline already has the id it will keep. */
export async function createNote(init: NewNote): Promise<NoteMeta> {
  const now = new Date().toISOString()
  const { data: me } = await supabase.auth.getSession()
  const row = {
    id: crypto.randomUUID(),
    title: init.title ?? '',
    content: init.content ?? { type: 'doc', content: [] },
    body_text: init.bodyText ?? '',
    folder_id: init.folderId ?? null,
    course_id: init.courseId ?? null,
    week: init.week ?? null,
    lecture_date: init.lectureDate ?? null,
    created_at: now,
    updated_at: now,
  }
  const { error } = await supabase.from('notes').insert(row)
  if (error) {
    reportWriteError('The note was not created', writeErrorText(error))
    throw error
  }
  return toMeta({ ...row, user_id: me.session?.user.id ?? '', assignment_ids: [], pinned: false, excerpt: (init.bodyText ?? '').slice(0, 180) })
}

export interface NotePatch {
  title?: string
  content?: JSONContent
  bodyText?: string
  folderId?: string | null
  courseId?: string | null
  week?: number | null
  lectureDate?: string | null
  assignmentIds?: string[]
  pinned?: boolean
}

export async function updateNote(id: string, patch: NotePatch): Promise<boolean> {
  const row: Record<string, unknown> = {}
  if (patch.title !== undefined) row.title = patch.title.slice(0, 200)
  if (patch.content !== undefined) row.content = patch.content
  if (patch.bodyText !== undefined) row.body_text = patch.bodyText.slice(0, 200000)
  if (patch.folderId !== undefined) row.folder_id = patch.folderId
  if (patch.courseId !== undefined) row.course_id = patch.courseId
  if (patch.week !== undefined) row.week = patch.week
  if (patch.lectureDate !== undefined) row.lecture_date = patch.lectureDate
  if (patch.assignmentIds !== undefined) row.assignment_ids = patch.assignmentIds
  if (patch.pinned !== undefined) row.pinned = patch.pinned
  const { error } = await supabase.from('notes').update(row).eq('id', id)
  if (error) {
    reportWriteError('Your note did not save', writeErrorText(error))
    return false
  }
  return true
}

/** Moves to trash (deleted_at), so a mistaken delete is not the end of it. */
export async function trashNote(id: string): Promise<boolean> {
  const { error } = await supabase.from('notes').update({ deleted_at: new Date().toISOString() }).eq('id', id)
  if (error) reportWriteError('The note was not deleted', writeErrorText(error))
  return !error
}

export async function restoreNote(id: string): Promise<boolean> {
  const { error } = await supabase.from('notes').update({ deleted_at: null }).eq('id', id)
  if (error) reportWriteError('The note was not restored', writeErrorText(error))
  return !error
}

export interface SearchHit {
  id: string
  title: string
  /** A fragment of the note with the match marked by << >>. */
  snippet: string
  courseId: string | null
}

export async function searchNotes(q: string): Promise<SearchHit[]> {
  const { data, error } = await supabase.rpc('search_notes', { p_q: q, p_limit: 40 })
  if (error) throw error
  return ((data ?? []) as { id: string; title: string; snippet: string; course_id: string | null }[]).map((r) => ({
    id: r.id,
    title: r.title,
    snippet: r.snippet,
    courseId: r.course_id,
  }))
}

export async function listVersions(noteId: string): Promise<NoteVersion[]> {
  const { data, error } = await supabase
    .from('note_versions')
    .select('id,title,content,created_at')
    .eq('note_id', noteId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as { id: string; title: string; content: JSONContent; created_at: string }[]).map((v) => ({
    id: v.id,
    title: v.title,
    content: v.content,
    createdAt: v.created_at,
  }))
}

/* ── Folders ───────────────────────────────────────────────────────────── */

const FOLDER_COLS = 'id,name,parent_id,position,course_id,icon,color,pinned,user_id'

interface FolderRow {
  id: string
  name: string
  parent_id: string | null
  position: number
  course_id: string | null
  icon: string | null
  color: string | null
  pinned: boolean | null
  user_id: string
}

const toFolder = (f: FolderRow): NoteFolder => ({
  id: f.id,
  name: f.name,
  parentId: f.parent_id,
  position: f.position,
  courseId: f.course_id,
  icon: f.icon ?? 'folder',
  color: f.color ?? 'slate',
  pinned: !!f.pinned,
})

/** Makes a folder for each current class that does not have one yet. */
export async function ensureClassFolders(): Promise<void> {
  await supabase.rpc('ensure_class_folders')
}

/** My own folders (classes included). Shared folders come from sharing-api. */
export async function listFolders(myId: string): Promise<NoteFolder[]> {
  const { data, error } = await supabase
    .from('note_folders')
    .select(FOLDER_COLS)
    .eq('user_id', myId)
    .order('position')
    .order('name')
  if (error) throw error
  return ((data ?? []) as FolderRow[]).map(toFolder)
}

export async function getFolder(id: string): Promise<NoteFolder | null> {
  const { data } = await supabase.from('note_folders').select(FOLDER_COLS).eq('id', id).maybeSingle()
  return data ? toFolder(data as FolderRow) : null
}

export async function createFolder(init: { name: string; icon?: string; color?: string; parentId?: string | null }): Promise<NoteFolder | null> {
  const folder = {
    id: crypto.randomUUID(),
    name: init.name.trim().slice(0, 80),
    parent_id: init.parentId ?? null,
    position: Date.now() % 1_000_000_000,
    icon: init.icon ?? 'folder',
    color: init.color ?? 'slate',
  }
  const { error } = await supabase.from('note_folders').insert(folder)
  if (error) {
    reportWriteError('The folder was not created', writeErrorText(error))
    return null
  }
  return { id: folder.id, name: folder.name, parentId: folder.parent_id, position: folder.position, courseId: null, icon: folder.icon, color: folder.color, pinned: false }
}

export interface FolderPatch {
  name?: string
  icon?: string
  color?: string
  pinned?: boolean
  parentId?: string | null
  position?: number
}

export async function updateFolder(id: string, patch: FolderPatch): Promise<boolean> {
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name.trim().slice(0, 80)
  if (patch.icon !== undefined) row.icon = patch.icon
  if (patch.color !== undefined) row.color = patch.color
  if (patch.pinned !== undefined) row.pinned = patch.pinned
  if (patch.parentId !== undefined) row.parent_id = patch.parentId
  if (patch.position !== undefined) row.position = patch.position
  const { error } = await supabase.from('note_folders').update(row).eq('id', id)
  if (error) reportWriteError('The folder was not changed', writeErrorText(error))
  return !error
}

/** Its notes are kept and become unfiled (folder_id → null), never deleted. */
export async function deleteFolder(id: string): Promise<boolean> {
  const { error } = await supabase.from('note_folders').delete().eq('id', id)
  if (error) reportWriteError('The folder was not deleted', writeErrorText(error))
  return !error
}

/* ── Custom templates ──────────────────────────────────────────────────── */

export async function listTemplates(): Promise<NoteTemplate[]> {
  const { data, error } = await supabase.from('note_templates').select('id,name,content').order('created_at')
  if (error) throw error
  return ((data ?? []) as { id: string; name: string; content: JSONContent }[]).map((t) => ({ ...t, builtIn: false }))
}

export async function saveTemplate(name: string, content: JSONContent): Promise<NoteTemplate | null> {
  const t = { id: crypto.randomUUID(), name: name.trim().slice(0, 80), content }
  const { error } = await supabase.from('note_templates').insert(t)
  if (error) {
    reportWriteError('The template was not saved', writeErrorText(error))
    return null
  }
  return { ...t, builtIn: false }
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const { error } = await supabase.from('note_templates').delete().eq('id', id)
  if (error) reportWriteError('The template was not deleted', writeErrorText(error))
  return !error
}
