import { supabase } from '@/lib/supabase'
import { localUser } from '@/lib/local-user'

/**
 * Files in Notes. Two sources, one list:
 *  - `folder`: uploaded into a Notes folder (table folder_files, bucket folder-files);
 *  - `course`: a syllabus kept when the course was created (table course_files,
 *    bucket course-files). It is shown in its class folder, read from where it
 *    already lives, never copied.
 * See db/notes_files.sql for who may read and change what.
 */
export interface NoteFile {
  /** Prefixed with its source so a folder file and a syllabus never collide. */
  key: string
  id: string
  source: 'folder' | 'course'
  ownerId: string
  /** A Notes folder (folder files). null = General. */
  folderId: string | null
  /** The course a syllabus belongs to (course files). */
  courseId: string | null
  name: string
  path: string
  mime: string
  sizeBytes: number | null
  createdAt: string
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024

/** What the bucket accepts, by extension, for the file picker. */
export const FILE_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.gif,.docx,.pptx,.xlsx,.doc,.ppt,.xls,.txt,.csv'

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword',
  ppt: 'application/vnd.ms-powerpoint',
  xls: 'application/vnd.ms-excel',
  txt: 'text/plain',
  csv: 'text/csv',
}

function extOf(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name)
  return m ? m[1].toLowerCase() : ''
}

/** The type we store, decided from the extension we accept, not from whatever
 *  the browser claims (an empty type on Windows is common for .pptx). */
export function fileMime(file: File): string | null {
  return MIME_BY_EXT[extOf(file.name)] ?? null
}

const bucketOf = (f: Pick<NoteFile, 'source'>) => (f.source === 'course' ? 'course-files' : 'folder-files')

interface FolderRow {
  id: string
  user_id: string
  folder_id: string | null
  name: string
  path: string
  mime: string | null
  size_bytes: number | null
  created_at: string
}
interface CourseRow {
  id: string
  user_id: string
  course_id: string
  name: string
  path: string
  mime: string | null
  size_bytes: number | null
  created_at: string
}

/** Everything I can see: files in my folders, in folders shared with me, and my syllabi. */
export async function listFiles(): Promise<NoteFile[]> {
  const [folder, course] = await Promise.all([
    supabase
      .from('folder_files')
      .select('id,user_id,folder_id,name,path,mime,size_bytes,created_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('course_files')
      .select('id,user_id,course_id,name,path,mime,size_bytes,created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ])
  const out: NoteFile[] = []
  // A missing table (migration not run) costs the files, never the notes.
  for (const r of (folder.data ?? []) as FolderRow[]) {
    out.push({
      key: `f:${r.id}`, id: r.id, source: 'folder', ownerId: r.user_id, folderId: r.folder_id,
      courseId: null, name: r.name, path: r.path, mime: r.mime ?? '', sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    })
  }
  for (const r of (course.data ?? []) as CourseRow[]) {
    out.push({
      key: `c:${r.id}`, id: r.id, source: 'course', ownerId: r.user_id, folderId: null,
      courseId: r.course_id, name: r.name, path: r.path, mime: r.mime ?? 'application/pdf',
      sizeBytes: r.size_bytes, createdAt: r.created_at,
    })
  }
  return out
}

export type UploadResult = { ok: true; file: NoteFile } | { ok: false; error: string }

export async function uploadFile(folderId: string | null, file: File): Promise<UploadResult> {
  const mime = fileMime(file)
  if (!mime) return { ok: false, error: `${file.name}: that kind of file can't be kept here.` }
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: `${file.name} is over 25 MB.` }
  const { data } = await localUser()
  const uid = data.user?.id
  if (!uid) return { ok: false, error: 'Sign in to upload files.' }
  const path = `${uid}/${crypto.randomUUID()}.${extOf(file.name)}`
  const up = await supabase.storage.from('folder-files').upload(path, file, { contentType: mime, upsert: false })
  if (up.error) return { ok: false, error: `${file.name} did not upload.` }
  const { data: row, error } = await supabase
    .from('folder_files')
    .insert({ folder_id: folderId, name: file.name.slice(0, 200), path, mime, size_bytes: file.size })
    .select('id,user_id,folder_id,name,path,mime,size_bytes,created_at')
    .single()
  if (error || !row) {
    // Nothing points at the upload, so do not leave it behind.
    await supabase.storage.from('folder-files').remove([path])
    return { ok: false, error: `${file.name} could not be added to this folder.` }
  }
  const r = row as FolderRow
  return {
    ok: true,
    file: {
      key: `f:${r.id}`, id: r.id, source: 'folder', ownerId: r.user_id, folderId: r.folder_id,
      courseId: null, name: r.name, path: r.path, mime: r.mime ?? mime, sizeBytes: r.size_bytes,
      createdAt: r.created_at,
    },
  }
}

export async function renameFile(f: NoteFile, name: string): Promise<boolean> {
  const clean = name.trim().slice(0, 200)
  if (!clean) return false
  const table = f.source === 'course' ? 'course_files' : 'folder_files'
  const { error } = await supabase.from(table).update({ name: clean }).eq('id', f.id)
  return !error
}

/** Folder files only: a syllabus belongs to its class. */
export async function moveFile(f: NoteFile, folderId: string | null): Promise<boolean> {
  if (f.source !== 'folder') return false
  const { error } = await supabase.from('folder_files').update({ folder_id: folderId }).eq('id', f.id)
  return !error
}

export async function deleteFile(f: NoteFile): Promise<boolean> {
  const table = f.source === 'course' ? 'course_files' : 'folder_files'
  const { error } = await supabase.from(table).delete().eq('id', f.id)
  if (error) return false
  await supabase.storage.from(bucketOf(f)).remove([f.path])
  return true
}

/** A ten-minute link to the private file. */
export async function fileUrl(f: Pick<NoteFile, 'source' | 'path'>, download?: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(bucketOf(f))
    .createSignedUrl(f.path, 600, download ? { download } : undefined)
  return error ? null : data.signedUrl
}

/** Find one file by its key (`f:<id>` or `c:<id>`), for a link inside a note. */
export async function getFileByKey(key: string): Promise<NoteFile | null> {
  const [kind, id] = key.split(':')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const all = await listFiles()
  return all.find((f) => f.key === `${kind}:${id}`) ?? null
}

export function formatSize(bytes: number | null): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export const isPdfFile = (f: Pick<NoteFile, 'mime' | 'name'>) =>
  f.mime === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
export const isImageFile = (f: Pick<NoteFile, 'mime'>) => f.mime.startsWith('image/')
