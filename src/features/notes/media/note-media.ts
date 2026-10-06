import { supabase } from '@/lib/supabase'
import { isEncodedType, EXT } from '@/lib/canvas-encode'
import { reencodeToWebp } from '@/lib/imageUpload'

/**
 * Images inside notes. Stored privately at note-media/<note id>/<file>: anyone
 * who can read the note can read its images, owners and editors can add them
 * (db/notes_collab.sql). The document keeps the PATH, never a URL — a signed
 * link expires, and a note must still show its pictures next term.
 */
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
const MAX_INPUT = 15 * 1024 * 1024
const MAX_DIM = 2000

export async function uploadNoteImage(noteId: string, file: File): Promise<{ path: string; width: number; height: number }> {
  if (!ACCEPT.includes(file.type)) throw new Error('Choose a PNG, JPG, WEBP or GIF image.')
  if (file.size > MAX_INPUT) throw new Error('That image is too large (15 MB max).')
  // A GIF keeps its animation; everything else is resized and compressed.
  const blob = file.type === 'image/gif' ? file : await reencodeToWebp(file, MAX_DIM, 'image/jpeg')
  const type = file.type === 'image/gif' ? 'image/gif' : isEncodedType(blob.type) ? blob.type : 'image/jpeg'
  const ext = type === 'image/gif' ? 'gif' : EXT[type as keyof typeof EXT]
  const path = `${noteId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('note-media').upload(path, blob, { contentType: type, cacheControl: '31536000' })
  if (error) throw new Error(/row-level security|policy/i.test(error.message) ? 'You cannot add images to this note.' : error.message)
  const dims = await measure(blob)
  return { path, ...dims }
}

function measure(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
      URL.revokeObjectURL(url)
    }
    img.src = url
  })
}

/** Signed links, kept for most of their life and then renewed. */
const cache = new Map<string, { url: string; until: number }>()

export async function noteImageUrl(path: string): Promise<string | null> {
  const hit = cache.get(path)
  if (hit && hit.until > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('note-media').createSignedUrl(path, 3600)
  if (error || !data) return null
  cache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60_000 })
  return data.signedUrl
}
