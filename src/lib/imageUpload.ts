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
export type ImageKind = 'logo' | 'banner' | 'post' | 'story'

/** How large each kind is allowed to be on its longest edge. A story fills a
 *  phone and a logo is 40px on a row, so one number for both would either
 *  blur the story or ship a 1600px avatar to every feed row. */
const MAX_DIM: Record<ImageKind, number> = {
  logo: 512,
  banner: 1600,
  post: 1440,
  story: 1440,
}

export async function uploadOrgImage(file: File, kind: ImageKind): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) throw new Error('Please sign in first.')
  if (!ACCEPT.includes(file.type)) throw new Error('Choose a PNG, JPG, WEBP, or GIF image.')
  if (file.size > MAX_INPUT_BYTES) throw new Error('That image is too large (8 MB max).')

  // Cap dimensions (keeps files small) + re-encode to a clean raster WEBP.
  const blob = await reencodeToWebp(file, MAX_DIM[kind] ?? 1024)

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
  if (!w0 || !h0) throw new Error('That image looked empty: try another.')
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

/* ────────────────────────────────────────────────────────────────────────────
 * VIDEO
 *
 * What a picture gets and a video cannot: the canvas re-encode. There is no
 * way in a browser to re-draw a video frame by frame at upload time, so the
 * bytes we store are the bytes that were chosen. What is left is a genuinely
 * shorter list and it is worth being plain about it:
 *
 *   • the CONTAINER is checked against its magic bytes, not its name and not
 *     the type the browser claimed — a file called clip.mp4 that is not one is
 *     refused here rather than at play time;
 *   • the stored content-type is the one WE sniffed;
 *   • the bucket is public, allows only mp4/webm, and serves with that fixed
 *     type, so nothing in it can be fetched as a script or a page;
 *   • 25 MB, which is about a minute of phone video.
 *
 * .MOV IS REFUSED ON PURPOSE. It is what an iPhone records, and Chrome on
 * Windows and Android mostly cannot play it — so accepting one produces a post
 * that some of the people it was written for simply cannot watch. The error
 * says so instead of storing it and failing quietly later. In practice iOS
 * transcodes to H.264/MP4 when the input asks for `video/mp4`, which is why
 * VIDEO_ACCEPT_ATTR names the types rather than using `video/*`.
 * ──────────────────────────────────────────────────────────────────────────── */

const MAX_VIDEO_BYTES = 25 * 1024 * 1024
export const VIDEO_ACCEPT_ATTR = 'video/mp4,video/webm'
export const MEDIA_ACCEPT_ATTR = `${IMAGE_ACCEPT_ATTR},${VIDEO_ACCEPT_ATTR}`

/** What an upload gives back: enough to render it without guessing. */
export interface UploadedMedia {
  url: string
  kind?: 'video'
  /** Natural dimensions, so the card can reserve the right box BEFORE the
   *  bytes arrive. Without them every post is a square and a portrait video is
   *  cropped to one. */
  w?: number
  h?: number
}

/** The first bytes of the file, as the two containers we accept write them. */
async function sniffVideo(file: File): Promise<'video/mp4' | 'video/webm' | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  // WebM/Matroska: EBML header.
  if (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return 'video/webm'
  // ISO base media (MP4/M4V/MOV all share it): "ftyp" at offset 4. The brand
  // that follows is what separates them, and `qt  ` is QuickTime.
  const tag = String.fromCharCode(head[4], head[5], head[6], head[7])
  if (tag === 'ftyp') {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11])
    if (brand.startsWith('qt')) return null
    return 'video/mp4'
  }
  return null
}

export async function uploadOrgVideo(file: File): Promise<UploadedMedia> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id
  if (!uid) throw new Error('Please sign in first.')
  if (file.size > MAX_VIDEO_BYTES) throw new Error('That video is too large (25 MB max).')

  const type = await sniffVideo(file)
  if (!type) {
    throw new Error(
      file.type === 'video/quicktime' || /\.mov$/i.test(file.name)
        ? 'Most browsers cannot play .mov — export it as MP4 and try again.'
        : 'Choose an MP4 or WEBM video.',
    )
  }

  const size = await videoSize(file)
  const path = `${uid}/clip-${crypto.randomUUID().slice(0, 8)}.${type === 'video/webm' ? 'webm' : 'mp4'}`
  const { error } = await supabase.storage.from('org-video').upload(path, file, {
    contentType: type,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return {
    url: supabase.storage.from('org-video').getPublicUrl(path).data.publicUrl,
    kind: 'video',
    ...size,
  }
}

/** Dimensions via a detached <video>. Best effort: a file whose metadata will
 *  not load still uploads, and the card falls back to a square. */
function videoSize(file: File): Promise<{ w?: number; h?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const el = document.createElement('video')
    const done = (out: { w?: number; h?: number }) => {
      URL.revokeObjectURL(url)
      resolve(out)
    }
    el.preload = 'metadata'
    el.onloadedmetadata = () => done({ w: el.videoWidth || undefined, h: el.videoHeight || undefined })
    el.onerror = () => done({})
    el.src = url
  })
}

/** Same, for a picture — so an image post can reserve its real shape too. */
export async function uploadOrgImageSized(file: File, kind: ImageKind): Promise<UploadedMedia> {
  const url = await uploadOrgImage(file, kind)
  const size = await imageSize(file)
  return { url, ...size }
}

function imageSize(file: File): Promise<{ w?: number; h?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    const done = (out: { w?: number; h?: number }) => {
      URL.revokeObjectURL(url)
      resolve(out)
    }
    img.onload = () => done({ w: img.naturalWidth || undefined, h: img.naturalHeight || undefined })
    img.onerror = () => done({})
    img.src = url
  })
}
