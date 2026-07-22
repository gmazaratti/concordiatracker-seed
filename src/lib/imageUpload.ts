import { supabase } from './supabase'

/** Input types we accept (a GIF is flattened to a static WEBP on re-encode). */
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
/** Reject obviously-huge files before we even decode them. */
const MAX_INPUT_BYTES = 8 * 1024 * 1024

export const IMAGE_ACCEPT_ATTR = ACCEPT.join(',')

/**
 * Upload an org image (logo/banner) to the public `org-media` bucket and return
 * its public URL.
 *
 * SECURITY: the file is RE-ENCODED through a canvas before upload — the bytes
 * that leave the browser are a freshly-drawn raster WEBP, so any embedded script,
 * EXIF, or polyglot payload in the original is destroyed (you cannot "execute
 * code through it"). SVG is rejected outright (it can carry scripts), size is
 * capped here and at the bucket, and the storage path is scoped to the user's own
 * folder by RLS.
 */
export async function uploadOrgImage(file: File, kind: 'logo' | 'banner'): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) throw new Error('Please sign in first.')
  if (!ACCEPT.includes(file.type)) throw new Error('Choose a PNG, JPG, WEBP, or GIF image.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is too large (8 MB max).')

  // Cap dimensions (keeps files small) + re-encode to a clean raster WEBP.
  const maxDim = kind === 'banner' ? 1600 : 512
  const blob = await reencodeToWebp(file, maxDim)

  const path = `${uid}/${kind}-${crypto.randomUUID().slice(0, 8)}.webp`
  const { error } = await supabase.storage.from('org-media').upload(path, blob, {
    contentType: 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return supabase.storage.from('org-media').getPublicUrl(path).data.publicUrl
}

async function reencodeToWebp(file: File, maxDim: number): Promise<Blob> {
  const source = await loadImage(file)
  const w0 = 'width' in source ? source.width : 0
  const h0 = 'height' in source ? source.height : 0
  if (!w0 || !h0) throw new Error('That image looked empty — try another.')
  const scale = Math.min(1, maxDim / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process the image on this device.')
  ctx.drawImage(source, 0, 0, w, h)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85))
  if (!blob) throw new Error('Could not process the image.')
  return blob
}

/** Decode via createImageBitmap when available (fast, off-thread), else an <img>. */
async function loadImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall through to <img> */
    }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}
