import { noteImageUrl } from '../media/note-media'
import { readCrop } from '../media/image-geometry'
import { readStrokes, strokePath, WIDTH } from '../drawing/drawing-model'

/** A picture ready to embed in an exported file: PNG or JPEG bytes and pixel size. */
export interface Raster { data: Uint8Array; type: 'png' | 'jpg'; width: number; height: number; dataUrl: string }

function toRaster(canvas: HTMLCanvasElement, type: 'png' | 'jpg'): Promise<Raster | null> {
  return new Promise((resolve) => {
    const mime = type === 'png' ? 'image/png' : 'image/jpeg'
    const dataUrl = canvas.toDataURL(mime, 0.9)
    canvas.toBlob(async (b) => {
      if (!b) return resolve(null)
      resolve({ data: new Uint8Array(await b.arrayBuffer()), type, width: canvas.width, height: canvas.height, dataUrl })
    }, mime, 0.9)
  })
}

function load(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * A note image as PNG/JPEG with its crop applied. Word cannot show WebP, which
 * is how most note images are stored, so every picture goes through a canvas.
 * Capped at 1600px wide: an export is for reading, not for re-editing photos.
 */
export async function imageRaster(attrs: Record<string, unknown>): Promise<Raster | null> {
  const path = attrs.path as string | null
  const src = path ? await noteImageUrl(path) : (attrs.src as string | null)
  if (!src) return null
  const img = await load(src)
  if (!img) return null
  const crop = readCrop(attrs.crop) ?? { x: 0, y: 0, w: 1, h: 1 }
  const sw = img.naturalWidth * crop.w
  const sh = img.naturalHeight * crop.h
  const scale = Math.min(1, 1600 / sw)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(sw * scale))
  canvas.height = Math.max(1, Math.round(sh * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  try {
    ctx.drawImage(img, img.naturalWidth * crop.x, img.naturalHeight * crop.y, sw, sh, 0, 0, canvas.width, canvas.height)
    return await toRaster(canvas, path?.endsWith('.png') || path?.endsWith('.gif') ? 'png' : 'jpg')
  } catch {
    return null
  }
}

/** A drawing, painted onto white at twice its size so the lines stay crisp. */
export async function drawingRaster(attrs: Record<string, unknown>): Promise<Raster | null> {
  const strokes = readStrokes(attrs.strokes)
  const height = Number(attrs.height) || 360
  const paths = strokes.map((s) => `<path d="${strokePath(s)}" fill="none" stroke="${s.c}" stroke-width="${s.w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${s.t === 'hl' ? 0.35 : 1}"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${height}" width="${WIDTH * 2}" height="${height * 2}"><rect width="100%" height="100%" fill="#fff"/>${paths}</svg>`
  const img = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
  if (!img) return null
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * 2
  canvas.height = height * 2
  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
  return toRaster(canvas, 'png')
}
