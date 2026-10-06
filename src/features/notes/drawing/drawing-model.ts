/**
 * Handwriting, stored as VECTOR strokes on the note itself (not a picture):
 * small, sharp at any zoom, editable later, and it merges like any other edit
 * when two people are in the note.
 *
 * Coordinates are on a fixed board WIDTH units wide; the height grows as you
 * need room. Points are whole numbers, flattened [x1, y1, x2, y2, …].
 */
export type Tool = 'pen' | 'hl' | 'line' | 'rect' | 'ellipse' | 'eraser'
export interface Stroke { t: Exclude<Tool, 'eraser'>; c: string; w: number; p: number[] }

export const WIDTH = 800
export const MIN_HEIGHT = 240
export const MAX_HEIGHT = 2400
export const MAX_STROKES = 600
export const MAX_POINTS = 30000

export function readStrokes(raw: unknown): Stroke[] {
  if (!Array.isArray(raw)) return []
  const out: Stroke[] = []
  for (const s of raw.slice(0, MAX_STROKES)) {
    const v = s as Partial<Stroke>
    if (!v || !['pen', 'hl', 'line', 'rect', 'ellipse'].includes(String(v.t))) continue
    if (!Array.isArray(v.p) || v.p.length < 2 || v.p.some((n) => typeof n !== 'number' || !Number.isFinite(n))) continue
    const color = typeof v.c === 'string' && /^#[0-9a-f]{6}$/i.test(v.c) ? v.c : '#111111'
    out.push({ t: v.t as Stroke['t'], c: color, w: Math.min(40, Math.max(1, Number(v.w) || 2)), p: v.p.map((n) => Math.round(n)) })
  }
  return out
}

export function pointCount(strokes: Stroke[]): number {
  return strokes.reduce((n, s) => n + s.p.length / 2, 0)
}

/** SVG path data for a stroke. Freehand strokes are smoothed through the midpoints. */
export function strokePath(s: Stroke): string {
  const p = s.p
  if (s.t === 'line') return `M${p[0]} ${p[1]}L${p.at(-2)} ${p.at(-1)}`
  if (s.t === 'rect' || s.t === 'ellipse') {
    const x1 = Math.min(p[0], p.at(-2)!), y1 = Math.min(p[1], p.at(-1)!)
    const x2 = Math.max(p[0], p.at(-2)!), y2 = Math.max(p[1], p.at(-1)!)
    if (s.t === 'rect') return `M${x1} ${y1}H${x2}V${y2}H${x1}Z`
    const rx = (x2 - x1) / 2, ry = (y2 - y1) / 2, cx = x1 + rx, cy = y1 + ry
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`
  }
  if (p.length <= 2) return `M${p[0]} ${p[1]}l0.1 0`
  let d = `M${p[0]} ${p[1]}`
  for (let i = 2; i < p.length - 2; i += 2) {
    const mx = (p[i] + p[i + 2]) / 2
    const my = (p[i + 1] + p[i + 3]) / 2
    d += `Q${p[i]} ${p[i + 1]} ${mx} ${my}`
  }
  return `${d}L${p.at(-2)} ${p.at(-1)}`
}

/** Skip points closer than a pixel or so: a slow pen sends hundreds. */
export function addPoint(p: number[], x: number, y: number): number[] {
  const n = p.length
  if (n >= 2 && Math.abs(p[n - 2] - x) < 1.5 && Math.abs(p[n - 1] - y) < 1.5) return p
  return [...p, Math.round(x), Math.round(y)]
}

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Whether the eraser at (x, y) touches a stroke. Shapes are hit on their outline. */
export function hits(s: Stroke, x: number, y: number, r = 10): boolean {
  const reach = r + s.w / 2
  const p = s.p
  if (s.t === 'rect' || s.t === 'ellipse') {
    const x1 = Math.min(p[0], p.at(-2)!), y1 = Math.min(p[1], p.at(-1)!)
    const x2 = Math.max(p[0], p.at(-2)!), y2 = Math.max(p[1], p.at(-1)!)
    const edges = [[x1, y1, x2, y1], [x2, y1, x2, y2], [x2, y2, x1, y2], [x1, y2, x1, y1]]
    return edges.some(([a, b, c, d]) => segDist(x, y, a, b, c, d) <= reach)
  }
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= reach
  const step = s.t === 'line' ? p.length - 2 : 2
  for (let i = 0; i + step < p.length; i += step) {
    if (segDist(x, y, p[i], p[i + 1], p[i + step], p[i + step + 1]) <= reach) return true
  }
  return false
}

/**
 * Set just before THIS screen inserts a drawing, so that drawing opens for
 * drawing at once. Local on purpose: an attribute in the document would also
 * pop the editor open for everyone else in the note when it reached them.
 */
export const drawingOpen = { next: false }

/** Read and clear the flag in one step. */
export function takeDrawingOpen(): boolean {
  const v = drawingOpen.next
  drawingOpen.next = false
  return v
}

/** Mark the next drawing this screen inserts to open for drawing. */
export function armDrawingOpen() {
  drawingOpen.next = true
}
