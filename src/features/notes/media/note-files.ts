import { supabase } from '@/lib/supabase'

/**
 * Files and voice notes inside notes, in their own private bucket
 * (note-files/<note id>/<file>): readable by anyone who can read the note,
 * addable by its owner and editors (db/notes_batch3.sql). The bucket itself
 * refuses any other type and anything over 25 MB; these checks only say so
 * before the upload rather than after it.
 */
export const FILE_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
}
export const FILE_ACCEPT = Object.keys(FILE_TYPES).join(',')
export const MAX_FILE = 25 * 1024 * 1024

/** The browser's MIME for a recording, without codec parameters. */
export function baseType(t: string): string {
  return t.split(';')[0].trim().toLowerCase()
}

export async function uploadNoteFile(noteId: string, file: Blob): Promise<{ path: string; size: number; mime: string }> {
  const mime = baseType(file.type)
  const ext = FILE_TYPES[mime]
  if (!ext) throw new Error('That kind of file cannot be added. Try a PDF, Word, PowerPoint, Excel, text or audio file.')
  if (file.size > MAX_FILE) throw new Error('That file is too large (25 MB max).')
  const path = `${noteId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('note-files').upload(path, file, { contentType: mime, cacheControl: '31536000' })
  if (error) throw new Error(/row-level security|policy/i.test(error.message) ? 'You cannot add files to this note.' : error.message)
  return { path, size: file.size, mime }
}

const cache = new Map<string, { url: string; until: number }>()

/** A short-lived link to a stored file. `download` makes the browser save it under its own name. */
export async function noteFileUrl(path: string, download?: string): Promise<string | null> {
  const k = `${path}|${download ?? ''}`
  const hit = cache.get(k)
  if (hit && hit.until > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('note-files').createSignedUrl(path, 3600, download ? { download } : undefined)
  if (error || !data) return null
  cache.set(k, { url: data.signedUrl, until: Date.now() + 50 * 60_000 })
  return data.signedUrl
}

export function fileSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
