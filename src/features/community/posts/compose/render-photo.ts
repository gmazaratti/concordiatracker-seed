import { encodeCanvas } from '@/lib/canvas-encode'
import {
  TEXT_SCALE,
  applyAdjust,
  canvasFont,
  coverRect,
  isIdentity,
  outputSize,
  wrapText,
  type Adjust,
  type PhotoText,
} from './photo-edit'

/**
 * Turn an edited photo into the exact file that will be posted.
 *
 * EVERYTHING ON SCREEN IS BAKED IN — crop, filter, sliders, text — so the post
 * is one ordinary image that every surface can show the same way. Nothing is
 * stored as "instructions for how to draw this later"; that is how a feed ends
 * up showing a different picture from the one the club approved.
 *
 * THE BYTES ARE A FRESH RASTER. Drawing through a canvas also does what
 * `uploadOrgImage` exists to do — the file that leaves the browser carries no
 * EXIF (no GPS of wherever the photo was taken) and nothing embedded.
 */

export interface RenderInput {
  src: string
  ratio: number
  panX: number
  panY: number
  adjust: Adjust
  texts: PhotoText[]
  longEdge?: number
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    // A draft's photos are already in storage; without this the canvas is
    // tainted and cannot be exported. Storage serves them with CORS open.
    if (/^https?:/.test(src)) img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That photo could not be opened.'))
    img.src = src
  })
}

export async function renderPhoto(input: RenderInput): Promise<{ blob: Blob; w: number; h: number }> {
  const img = await loadImage(input.src)
  const { sx, sy, sw, sh } = coverRect(img.naturalWidth, img.naturalHeight, input.ratio, input.panX, input.panY)
  // Never upscale: a small photo stays its own size rather than getting
  // blurrier in exchange for more bytes.
  const cap = Math.min(input.longEdge ?? 1440, Math.max(sw, sh))
  const { w, h } = outputSize(input.ratio, Math.round(cap))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This device could not process the photo.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)

  if (!isIdentity(input.adjust)) {
    const data = ctx.getImageData(0, 0, w, h)
    applyAdjust(data.data, input.adjust)
    ctx.putImageData(data, 0, 0)
  }

  // Fonts must be loaded before a canvas can draw them, or the first post of
  // the session goes out in the fallback face.
  if (input.texts.length > 0 && 'fonts' in document) {
    await Promise.all(
      input.texts.map((t) => document.fonts.load(canvasFont(t.font, 32)).catch(() => undefined)),
    )
  }
  for (const t of input.texts) drawText(ctx, t, w, h)

  const blob = await encodeCanvas(canvas, 0.9)
  return { blob, w, h }
}

function drawText(ctx: CanvasRenderingContext2D, t: PhotoText, w: number, h: number) {
  if (!t.text.trim()) return
  const size = Math.round(w * TEXT_SCALE)
  const lineHeight = size * 1.2
  ctx.font = canvasFont(t.font, size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lines = wrapText(t.text, w * 0.82, (s) => ctx.measureText(s).width)
  const cx = t.x * w
  const cy = t.y * h
  const top = cy - ((lines.length - 1) * lineHeight) / 2

  if (t.chip) {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width))
    const padX = size * 0.45
    const padY = size * 0.28
    const bw = widest + padX * 2
    const bh = lines.length * lineHeight + padY * 2
    ctx.fillStyle = 'rgba(0,0,0,0.55)'
    roundRect(ctx, cx - bw / 2, top - lineHeight / 2 - padY, bw, bh, size * 0.3)
    ctx.fill()
  } else {
    // A soft shadow so white text survives a bright sky, as it does in CSS.
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = size * 0.25
  }
  ctx.fillStyle = t.color
  lines.forEach((line, i) => ctx.fillText(line, cx, top + i * lineHeight))
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
