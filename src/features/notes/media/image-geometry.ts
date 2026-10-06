/** The part of a picture that is kept, as fractions of its full size. */
export interface Crop { x: number; y: number; w: number; h: number }

export const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 }
const MIN = 0.05

export const SIZE_PCT: Record<string, number> = { small: 33, medium: 55, large: 80, full: 100 }

export function readCrop(raw: unknown): Crop | null {
  const c = raw as Partial<Crop> | null
  if (!c || [c.x, c.y, c.w, c.h].some((v) => typeof v !== 'number' || !Number.isFinite(v))) return null
  return clampCrop(c as Crop)
}

/** A crop that stays inside the picture and never shrinks to nothing. */
export function clampCrop(c: Crop): Crop {
  const w = Math.min(1, Math.max(MIN, c.w))
  const h = Math.min(1, Math.max(MIN, c.h))
  return { x: Math.min(1 - w, Math.max(0, c.x)), y: Math.min(1 - h, Math.max(0, c.y)), w, h }
}

/** Width as a share of the page, from a drag of a corner. Centred images grow
 *  on both sides, so the box widens by twice the distance moved. */
export function widthFromDrag(startPct: number, dx: number, pageWidth: number, side: 'left' | 'right'): number {
  if (pageWidth <= 0) return startPct
  const delta = ((side === 'right' ? dx : -dx) * 2 * 100) / pageWidth
  return Math.round(Math.min(100, Math.max(10, startPct + delta)))
}

/** Moving one corner (or the whole box, for 'move') by a fraction of the picture. */
export function dragCrop(c: Crop, handle: 'nw' | 'ne' | 'sw' | 'se' | 'move', dx: number, dy: number): Crop {
  if (handle === 'move') return clampCrop({ ...c, x: c.x + dx, y: c.y + dy })
  let { x, y, w, h } = c
  if (handle.includes('w')) {
    const nx = Math.min(x + w - MIN, Math.max(0, x + dx))
    w += x - nx
    x = nx
  } else {
    w = Math.min(1 - x, Math.max(MIN, w + dx))
  }
  if (handle.includes('n')) {
    const ny = Math.min(y + h - MIN, Math.max(0, y + dy))
    h += y - ny
    y = ny
  } else {
    h = Math.min(1 - y, Math.max(MIN, h + dy))
  }
  return clampCrop({ x, y, w, h })
}
