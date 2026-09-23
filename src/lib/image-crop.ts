/**
 * Placing an image inside a frame: the geometry, with no DOM in it.
 *
 * WHY IT IS ITS OWN MODULE. The cropper shows you a preview and then exports
 * a file, and those are two different renderers of ONE transform. If they are
 * written twice they drift, and the drift is invisible until somebody's logo
 * ships off-centre — you only find out from the published profile. So the
 * transform is described once, here, and both the preview (a CSS `transform`)
 * and the export (a canvas transform) are built from the same numbers in the
 * same order.
 *
 * THE INVARIANT THE WHOLE THING RESTS ON: the image always covers the frame.
 * There is never a transparent gap at an edge, because a banner with a strip
 * of nothing down one side is not a thing anybody meant to make. Zoom starts
 * at "just covers" and only goes up; the offset is clamped so an edge cannot
 * be dragged inside the frame.
 */

export type Rotation = 0 | 90 | 180 | 270

export interface Size {
  w: number
  h: number
}

/** What the user has done to the image, in frame (CSS) pixels. */
export interface CropView {
  /** Multiplier over the cover baseline. 1 = exactly covers; never below 1. */
  zoom: number
  /** Offset of the image centre from the frame centre, in frame pixels. */
  x: number
  y: number
  rotation: Rotation
  flipX: boolean
  flipY: boolean
}

export const IDENTITY_VIEW: CropView = {
  zoom: 1,
  x: 0,
  y: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
}

export const MAX_ZOOM = 4

/** The image's bounding box after rotation — 90°/270° swap the axes. */
export function rotatedSize(src: Size, rotation: Rotation): Size {
  return rotation === 90 || rotation === 270 ? { w: src.h, h: src.w } : { w: src.w, h: src.h }
}

/**
 * The scale at which the image exactly covers the frame — the baseline zoom 1
 * maps to. `max`, not `min`: `min` would FIT it (letterboxed), and the gap is
 * the thing this is written to make impossible.
 */
export function coverScale(src: Size, frame: Size, rotation: Rotation = 0): number {
  const r = rotatedSize(src, rotation)
  if (r.w <= 0 || r.h <= 0) return 1
  return Math.max(frame.w / r.w, frame.h / r.h)
}

/** The image's on-screen size at this view. */
export function displaySize(src: Size, frame: Size, view: CropView): Size {
  const r = rotatedSize(src, view.rotation)
  const s = coverScale(src, frame, view.rotation) * view.zoom
  return { w: r.w * s, h: r.h * s }
}

/**
 * How far the centre may move before an edge comes inside the frame.
 * At zoom 1 along the tight axis this is 0 — the image is pinned, which is
 * correct: there is nothing spare to pan into.
 */
export function offsetBounds(src: Size, frame: Size, view: CropView): Size {
  const d = displaySize(src, frame, view)
  return {
    w: Math.max(0, (d.w - frame.w) / 2),
    h: Math.max(0, (d.h - frame.h) / 2),
  }
}

/** Pull an offset back inside the bounds. Every drag ends here. */
export function clampOffset(src: Size, frame: Size, view: CropView): { x: number; y: number } {
  const b = offsetBounds(src, frame, view)
  return {
    x: Math.min(b.w, Math.max(-b.w, view.x)),
    y: Math.min(b.h, Math.max(-b.h, view.y)),
  }
}

/** A view with its offset already legal — what state setters should store. */
export function normalizeView(src: Size, frame: Size, view: CropView): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom))
  const withZoom = { ...view, zoom }
  return { ...withZoom, ...clampOffset(src, frame, withZoom) }
}

/**
 * Zoom about a point rather than about the centre.
 *
 * Zooming from the origin makes the picture jump out from under the pointer,
 * which reads as the control being broken. The point under the cursor stays
 * under the cursor: the same rule the prereq board's canvas follows.
 *
 * `px`/`py` are relative to the frame centre, in frame pixels.
 */
export function zoomAbout(
  src: Size,
  frame: Size,
  view: CropView,
  nextZoom: number,
  px: number,
  py: number,
): CropView {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, nextZoom))
  const k = zoom / view.zoom
  // The image point under (px,py) must land back on (px,py) after scaling.
  const next = { ...view, zoom, x: px - (px - view.x) * k, y: py - (py - view.y) * k }
  return { ...next, ...clampOffset(src, frame, next) }
}

/** Turning right, staying inside 0–359 and on the four right angles. */
export function turn(rotation: Rotation, quarters: number): Rotation {
  const n = (((rotation / 90 + quarters) % 4) + 4) % 4
  return (n * 90) as Rotation
}

/**
 * The transform chain, as ordered steps. The preview applies it in CSS and the
 * export applies it to a canvas context multiplied by `scale` — that shared
 * list is the reason the exported file matches what was on screen.
 */
export function transformSteps(
  src: Size,
  frame: Size,
  view: CropView,
): { translate: { x: number; y: number }; rotate: number; scale: { x: number; y: number } } {
  const s = coverScale(src, frame, view.rotation) * view.zoom
  return {
    translate: { x: view.x, y: view.y },
    rotate: view.rotation,
    scale: { x: s * (view.flipX ? -1 : 1), y: s * (view.flipY ? -1 : 1) },
  }
}

/* ── What we ask people for ───────────────────────────────────────────────── */

/**
 * Output sizes, and the sizes quoted in the UI.
 *
 * THESE ARE MEASURED OFF THE REAL PROFILE, not picked because they are round.
 * The org banner renders 768×176 at the top of a `max-w-3xl` column and 144px
 * for the avatar, both doubled for a 2× screen — so 1600×400 and 512×512 clear
 * the real render with room to spare, and the numbers are still ones a person
 * can hold in their head while they crop something.
 */
export interface ImageSpec {
  /** Frame aspect, w/h. */
  aspect: number
  /** Exported pixel width; height follows the aspect. */
  out: number
  /** What the (i) says. */
  recommended: string
  note: string
}

export const IMAGE_SPECS = {
  logo: {
    aspect: 1,
    out: 512,
    recommended: '512 × 512',
    note: 'Square. It is shown as a circle, so keep anything important away from the corners.',
  },
  banner: {
    aspect: 4,
    out: 1600,
    recommended: '1600 × 400',
    note: 'Wide. On a phone the sides are cropped in, so keep the subject near the middle.',
  },
  eventBanner: {
    aspect: 16 / 9,
    out: 1280,
    recommended: '1280 × 720',
    note: 'Landscape. Cards crop it to a shorter strip, so avoid text at the top and bottom.',
  },
} satisfies Record<string, ImageSpec>

export type CropKind = keyof typeof IMAGE_SPECS

export function outputSize(kind: CropKind): Size {
  const spec = IMAGE_SPECS[kind]
  return { w: spec.out, h: Math.round(spec.out / spec.aspect) }
}
