import type { PostMedia } from '@/lib/social-posts'
import { NO_ADJUST, type Adjust, type PhotoText } from './photo-edit'

/**
 * One photo or clip in a post that is being put together.
 *
 * NOTHING IS UPLOADED WHILE YOU CHOOSE. The old composer sent each file to
 * storage the moment it was picked and only then showed it — so a slow
 * connection, a refused upload or a file the browser could not decode looked
 * exactly like "I picked a photo and nothing happened", which is the bug this
 * was rebuilt around. Now a pick is decoded locally and on screen at once;
 * uploading happens on Share, where there is a progress line and an error has
 * somewhere visible to go.
 */
export interface ComposeItem {
  key: string
  kind: 'image' | 'video'
  /** An object URL for something just picked, or the stored URL of a draft's. */
  src: string
  file?: File
  /** Already in storage (a draft). Re-used as-is unless it is edited. */
  stored?: PostMedia
  w: number
  h: number
  filter: string
  slider: Adjust
  texts: PhotoText[]
  panX: number
  panY: number
}

let seq = 0
const nextKey = () => `item-${Date.now().toString(36)}-${(seq++).toString(36)}`

/** Phone photos are routinely 10–15 MB. The limit is about what a phone can
 *  decode without falling over, not about storage: the upload is re-drawn to
 *  1440px and is a fraction of this. */
const MAX_PHOTO_BYTES = 30 * 1024 * 1024
const MAX_VIDEO_BYTES = 25 * 1024 * 1024

export const PICK_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm'

function dims(src: string, kind: 'image' | 'video'): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    if (kind === 'video') {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.muted = true
      v.onloadedmetadata = () => resolve({ w: v.videoWidth || 1, h: v.videoHeight || 1 })
      v.onerror = () => reject(new Error('unreadable'))
      v.src = src
      return
    }
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
    img.onerror = () => reject(new Error('unreadable'))
    img.src = src
  })
}

/**
 * Read a picked file into an item, or say — in words a person can act on —
 * why it cannot be used. Every refusal names the file.
 */
export async function itemFromFile(file: File): Promise<ComposeItem> {
  const isVideo = file.type.startsWith('video/')
  const lower = file.name.toLowerCase()
  if (/\.(heic|heif)$/.test(lower) || /heic|heif/.test(file.type)) {
    throw new Error(`${file.name}: HEIC photos cannot be opened in this browser. Export it as JPG and try again.`)
  }
  if (/\.mov$/.test(lower) || file.type === 'video/quicktime') {
    throw new Error(`${file.name}: most browsers cannot play .mov, so export it as MP4 and try again.`)
  }
  if (!isVideo && !file.type.startsWith('image/')) {
    throw new Error(`${file.name} is not a photo or a video.`)
  }
  if (!isVideo && file.size > MAX_PHOTO_BYTES) {
    throw new Error(`${file.name} is too large to open here (30 MB max).`)
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    throw new Error(`${file.name} is too large (25 MB max for a video).`)
  }
  const src = URL.createObjectURL(file)
  try {
    const { w, h } = await dims(src, isVideo ? 'video' : 'image')
    return {
      key: nextKey(),
      kind: isVideo ? 'video' : 'image',
      src,
      file,
      w,
      h,
      filter: 'none',
      slider: { ...NO_ADJUST },
      texts: [],
      panX: 0.5,
      panY: 0.5,
    }
  } catch {
    URL.revokeObjectURL(src)
    throw new Error(`${file.name} could not be opened. It may be damaged, or in a format this browser cannot read.`)
  }
}

/** A draft's stored media, ready to be edited again or reused as-is. */
export function itemFromStored(m: PostMedia): ComposeItem {
  return {
    key: nextKey(),
    kind: m.kind === 'video' ? 'video' : 'image',
    src: m.url,
    stored: m,
    w: m.w ?? 1080,
    h: m.h ?? 1080,
    filter: 'none',
    slider: { ...NO_ADJUST },
    texts: [],
    panX: 0.5,
    panY: 0.5,
  }
}

export function release(items: ComposeItem[]) {
  for (const it of items) if (it.src.startsWith('blob:')) URL.revokeObjectURL(it.src)
}
