/**
 * The maths behind editing a photo before it is posted. PURE — no DOM, no
 * React — so it is Node-tested, and so the preview and the exported file are
 * computed from ONE definition.
 *
 * WHY A COLOUR MATRIX AND NOT `ctx.filter`. The preview is an <img> with a CSS
 * `filter`, and the obvious export is to set the same string on a canvas. But
 * `CanvasRenderingContext2D.filter` only reached Safari recently, and on an
 * older iPhone it is silently ignored — the photo would preview with a filter
 * and post without one, which is exactly the "what I see is not what posts"
 * complaint this flow is being rebuilt to answer. So the export applies the
 * SAME operations as matrices, per pixel, using the formulas the Filter
 * Effects spec defines for each CSS function. The CSS string and the matrix
 * are generated from the same numbers in the same order.
 */

export interface Adjust {
  /** 1 = unchanged. */
  brightness: number
  contrast: number
  saturate: number
  /** 0..1 */
  sepia: number
  /** 0..1 */
  grayscale: number
  /** Degrees. */
  hue: number
}

export const NO_ADJUST: Adjust = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  sepia: 0,
  grayscale: 0,
  hue: 0,
}

export interface FilterPreset {
  id: string
  label: string
  adjust: Partial<Adjust>
}

/** Named for what they do, not after anybody's app. */
export const FILTERS: FilterPreset[] = [
  { id: 'none', label: 'Normal', adjust: {} },
  { id: 'vivid', label: 'Vivid', adjust: { contrast: 1.15, saturate: 1.35 } },
  { id: 'warm', label: 'Warm', adjust: { sepia: 0.22, saturate: 1.15, brightness: 1.04 } },
  { id: 'cool', label: 'Cool', adjust: { hue: -12, saturate: 0.95, brightness: 1.03 } },
  { id: 'fade', label: 'Fade', adjust: { contrast: 0.85, brightness: 1.08, saturate: 0.85 } },
  { id: 'film', label: 'Film', adjust: { sepia: 0.12, contrast: 1.08, saturate: 0.9 } },
  { id: 'mono', label: 'Mono', adjust: { grayscale: 1, contrast: 1.05 } },
  { id: 'noir', label: 'Noir', adjust: { grayscale: 1, contrast: 1.35, brightness: 0.95 } },
]

export function presetAdjust(id: string): Adjust {
  const p = FILTERS.find((f) => f.id === id) ?? FILTERS[0]
  return { ...NO_ADJUST, ...p.adjust }
}

/**
 * The user's sliders sit ON TOP of the preset: a "Vivid" photo that is then
 * brightened is both. Multiplicative for the three that are multipliers,
 * additive for the rest, clamped to what the sliders can express.
 */
export function combine(preset: Adjust, slider: Adjust): Adjust {
  return {
    brightness: preset.brightness * slider.brightness,
    contrast: preset.contrast * slider.contrast,
    saturate: preset.saturate * slider.saturate,
    sepia: Math.min(1, preset.sepia + slider.sepia),
    grayscale: Math.min(1, preset.grayscale + slider.grayscale),
    hue: preset.hue + slider.hue,
  }
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

export function isIdentity(a: Adjust): boolean {
  return (
    near(a.brightness, 1) &&
    near(a.contrast, 1) &&
    near(a.saturate, 1) &&
    near(a.sepia, 0) &&
    near(a.grayscale, 0) &&
    near(a.hue, 0)
  )
}

/** The CSS for the live preview. ORDER MATCHES `colorMatrix` below. */
export function cssFilter(a: Adjust): string {
  if (isIdentity(a)) return 'none'
  const parts: string[] = []
  if (!near(a.brightness, 1)) parts.push(`brightness(${a.brightness})`)
  if (!near(a.contrast, 1)) parts.push(`contrast(${a.contrast})`)
  if (!near(a.saturate, 1)) parts.push(`saturate(${a.saturate})`)
  if (!near(a.sepia, 0)) parts.push(`sepia(${a.sepia})`)
  if (!near(a.grayscale, 0)) parts.push(`grayscale(${a.grayscale})`)
  if (!near(a.hue, 0)) parts.push(`hue-rotate(${a.hue}deg)`)
  return parts.join(' ')
}

/**
 * A 4×5 row-major matrix acting on [r, g, b, a, 1] in 0..1. Only the RGB rows
 * matter here; alpha passes through.
 */
export type Matrix = number[]

const IDENTITY: Matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]

/** `next ∘ prev`: apply `prev`, then `next`. */
export function multiply(next: Matrix, prev: Matrix): Matrix {
  const out = new Array<number>(20).fill(0)
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 5; c++) {
      let v = c === 4 ? next[r * 5 + 4] : 0
      for (let k = 0; k < 4; k++) v += next[r * 5 + k] * prev[k * 5 + c]
      out[r * 5 + c] = v
    }
  }
  return out
}

function linear(slope: number, intercept: number): Matrix {
  return [
    slope, 0, 0, 0, intercept,
    0, slope, 0, 0, intercept,
    0, 0, slope, 0, intercept,
    0, 0, 0, 1, 0,
  ]
}

/* The Filter Effects spec's matrices, verbatim. */
function saturateM(s: number): Matrix {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0, 0,
    0, 0, 0, 1, 0,
  ]
}

function sepiaM(a: number): Matrix {
  const x = 1 - a
  return [
    0.393 + 0.607 * x, 0.769 - 0.769 * x, 0.189 - 0.189 * x, 0, 0,
    0.349 - 0.349 * x, 0.686 + 0.314 * x, 0.168 - 0.168 * x, 0, 0,
    0.272 - 0.272 * x, 0.534 - 0.534 * x, 0.131 + 0.869 * x, 0, 0,
    0, 0, 0, 1, 0,
  ]
}

function grayscaleM(a: number): Matrix {
  const x = 1 - a
  return [
    0.2126 + 0.7874 * x, 0.7152 - 0.7152 * x, 0.0722 - 0.0722 * x, 0, 0,
    0.2126 - 0.2126 * x, 0.7152 + 0.2848 * x, 0.0722 - 0.0722 * x, 0, 0,
    0.2126 - 0.2126 * x, 0.7152 - 0.7152 * x, 0.0722 + 0.9278 * x, 0, 0,
    0, 0, 0, 1, 0,
  ]
}

function hueM(deg: number): Matrix {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283, 0, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0, 0,
    0, 0, 0, 1, 0,
  ]
}

/**
 * One matrix per CSS function, in the order `cssFilter` writes them.
 *
 * KEPT SEPARATE, NOT MULTIPLIED TOGETHER, because the browser clamps every
 * step to 0..1 before the next one: `brightness(2) contrast(0.5)` on a light
 * pixel saturates at white first and only then loses contrast. One composed
 * matrix skips that clamp, and the exported photo would disagree with the
 * preview at exactly the edits people make most — a strong brighten.
 */
export function adjustSteps(a: Adjust): Matrix[] {
  const steps: Matrix[] = []
  if (!near(a.brightness, 1)) steps.push(linear(a.brightness, 0))
  if (!near(a.contrast, 1)) steps.push(linear(a.contrast, 0.5 - 0.5 * a.contrast))
  if (!near(a.saturate, 1)) steps.push(saturateM(a.saturate))
  if (!near(a.sepia, 0)) steps.push(sepiaM(a.sepia))
  if (!near(a.grayscale, 0)) steps.push(grayscaleM(a.grayscale))
  if (!near(a.hue, 0)) steps.push(hueM(a.hue))
  return steps
}

/** The whole adjustment as ONE matrix — only correct when no step clamps;
 *  used where that is fine (tests of the individual formulas). */
export function colorMatrix(a: Adjust): Matrix {
  return adjustSteps(a).reduce((m, step) => multiply(step, m), IDENTITY)
}

/** What the export runs: each step in turn, clamping between them. */
export function applyAdjust(px: Uint8ClampedArray, a: Adjust): void {
  for (const step of adjustSteps(a)) applyMatrix(px, step)
}

/** In place, over RGBA bytes. Each step clamps, as the browser's does. */
export function applyMatrix(px: Uint8ClampedArray, m: Matrix): void {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255
    const g = px[i + 1] / 255
    const b = px[i + 2] / 255
    px[i] = (m[0] * r + m[1] * g + m[2] * b + m[4]) * 255
    px[i + 1] = (m[5] * r + m[6] * g + m[7] * b + m[9]) * 255
    px[i + 2] = (m[10] * r + m[11] * g + m[12] * b + m[14]) * 255
  }
}

/* ── Shape ────────────────────────────────────────────────────────────────── */

export type AspectId = 'square' | 'portrait' | 'original'

/** The feed's own clamp (see `postAspect`): 4:5 at its tallest, 1.91:1 at its widest. */
export const MIN_RATIO = 4 / 5
export const MAX_RATIO = 1.91

export function ratioFor(aspect: AspectId, first: { w: number; h: number } | null): number {
  if (aspect === 'square') return 1
  if (aspect === 'portrait') return 4 / 5
  if (!first || !first.w || !first.h) return 1
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, first.w / first.h))
}

export interface Rect {
  sx: number
  sy: number
  sw: number
  sh: number
}

/**
 * The part of the source that fills a frame of `ratio` — a COVER crop — with
 * `pan` (0..1 on each axis, 0.5 = centred) choosing which part when the photo
 * is wider or taller than the frame. The preview positions the image with the
 * same two numbers (`object-position`), which is what keeps them in step.
 */
export function coverRect(srcW: number, srcH: number, ratio: number, panX = 0.5, panY = 0.5): Rect {
  const px = Math.min(1, Math.max(0, panX))
  const py = Math.min(1, Math.max(0, panY))
  if (srcW / srcH > ratio) {
    const sw = srcH * ratio
    return { sx: (srcW - sw) * px, sy: 0, sw, sh: srcH }
  }
  const sh = srcW / ratio
  return { sx: 0, sy: (srcH - sh) * py, sw: srcW, sh }
}

/** Output size: the frame's ratio, with the long edge capped. */
export function outputSize(ratio: number, longEdge: number): { w: number; h: number } {
  return ratio >= 1
    ? { w: longEdge, h: Math.round(longEdge / ratio) }
    : { w: Math.round(longEdge * ratio), h: longEdge }
}

/* ── Text on the photo ────────────────────────────────────────────────────── */

export interface PhotoText {
  text: string
  /** Fractions of the FRAME, so the text lands in the same place at any size. */
  x: number
  y: number
  color: string
  font: 'modern' | 'classic' | 'signature' | 'typewriter'
  /** A dark backing behind the words. */
  chip: boolean
}

/** Font size as a fraction of the frame's width — the preview and the export
 *  both multiply by the width they actually have. */
export const TEXT_SCALE = 0.062

/** The canvas `font` shorthand for each face. The preview sets the same
 *  family and weight in CSS. */
export function canvasFont(font: PhotoText['font'], px: number): string {
  switch (font) {
    case 'classic':
      return `600 ${px}px Inter, system-ui, sans-serif`
    case 'signature':
      return `italic 500 ${px}px "Hanken Grotesk", Inter, sans-serif`
    case 'typewriter':
      return `500 ${px}px ui-monospace, "SF Mono", Menlo, monospace`
    default:
      return `700 ${px}px "Hanken Grotesk", Inter, sans-serif`
  }
}

/** Greedy word wrap against a measure function, so it is testable without a
 *  canvas. A single word wider than the line is left on its own line rather
 *  than broken mid-word. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      out.push('')
      continue
    }
    let line = words[0]
    for (const w of words.slice(1)) {
      const next = `${line} ${w}`
      if (measure(next) <= maxWidth) line = next
      else {
        out.push(line)
        line = w
      }
    }
    out.push(line)
  }
  return out
}
