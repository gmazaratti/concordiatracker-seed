import type { JSONContent } from '@tiptap/react'
import { supabase } from '@/lib/supabase'
import { reportWriteError, writeErrorText } from '@/lib/write-errors'
import type { NoteFolder, NoteTemplate } from './types'

/**
 * Folders (classes included) and templates. Split from notes-api.ts, which
 * re-exports all of it, so callers import from either.
 */


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
