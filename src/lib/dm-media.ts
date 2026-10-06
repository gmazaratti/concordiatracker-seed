import { supabase } from '@/lib/supabase'
import { reencodeToWebp } from '@/lib/imageUpload'
import { EXT, isEncodedType } from '@/lib/canvas-encode'
import { localUser } from '@/lib/local-user'

/**
 * Photos in direct messages.
 *
 * Every photo is redrawn through a canvas and re-encoded (at most 1600px on
 * its long side) before it leaves the browser: that strips anything hidden in
 * the original file (location, camera data, a payload pretending to be a
 * picture) and keeps it small. The bucket then only accepts images up to
 * 5 MB, under the sender's own folder, and the database checks the message
 * itself (db/notes_batch3.sql): the path, that the file really exists, a
 * daily cap, and no photos to someone who has never written back.
 *
 * A GIF is kept as it is, to keep it moving, and only if it is small.
 */
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
const MAX_INPUT = 25 * 1024 * 1024
const MAX_GIF = 5 * 1024 * 1024
export const DM_IMAGE_ACCEPT = ACCEPT.join(',')

function measure(blob: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export async function uploadDmImage(file: File): Promise<{ path: string; w: number; h: number }> {
  if (!ACCEPT.includes(file.type)) throw new Error('Send a photo (JPG, PNG, WebP, HEIC or GIF).')
  if (file.size > MAX_INPUT) throw new Error('That photo is too large (25 MB max).')
  if (file.type === 'image/gif' && file.size > MAX_GIF) throw new Error('That GIF is too large (5 MB max).')
  const { data } = await localUser()
  const uid = data.user?.id
  if (!uid) throw new Error('You need to be signed in.')
  const blob = file.type === 'image/gif' ? file : await reencodeToWebp(file, 1600, 'image/jpeg')
  const type = file.type === 'image/gif' ? 'image/gif' : isEncodedType(blob.type) ? blob.type : 'image/jpeg'
  const ext = type === 'image/gif' ? 'gif' : EXT[type as keyof typeof EXT]
  const path = `${uid}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('dm-media').upload(path, blob, { contentType: type, cacheControl: '31536000' })
  if (error) throw new Error(/policy|security/i.test(error.message) ? 'That photo could not be uploaded.' : error.message)
  const { w, h } = await measure(blob)
  return { path, w, h }
}

const cache = new Map<string, { url: string; until: number }>()

/** A short-lived link to a photo you sent or were sent. */
export async function dmImageUrl(path: string): Promise<string | null> {
  const hit = cache.get(path)
  if (hit && hit.until > Date.now()) return hit.url
  const { data, error } = await supabase.storage.from('dm-media').createSignedUrl(path, 3600)
  if (error || !data) return null
  cache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60_000 })
  return data.signedUrl
}
