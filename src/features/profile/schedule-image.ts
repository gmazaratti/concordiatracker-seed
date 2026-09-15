import type { SharedClass } from '@/lib/social'
import { parseMeetingTimes } from '@/features/today/widgets/meeting-times'
import { COURSE_COLORS } from '@/lib/course-color'

/**
 * Draw a week to a PNG.
 *
 * Hand-drawn on a canvas rather than screenshotting the DOM, because every
 * library that does the latter is a dependency measured in hundreds of
 * kilobytes for one button — and this app has exactly one non-core runtime
 * dependency on purpose. Drawing it also means the exported image is designed
 * rather than captured: it gets a title, a date, and enough padding to survive
 * being cropped by whatever it is pasted into.
 *
 * PURE apart from the canvas it is handed, so the layout maths can be checked
 * without a browser.
 */
const PAD = 28
const HEADER = 74
const GUTTER = 52
const ROW_H = 46
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export interface WeekBounds {
  /** Minutes from midnight. */
  start: number
  end: number
}

/** The window worth drawing: what is actually scheduled, padded to a sane
 *  teaching day so a single 3pm class does not produce a one-row image. */
export function weekBounds(classes: SharedClass[]): WeekBounds {
  let start = 8 * 60
  let end = 18 * 60
  for (const c of classes) {
    for (const slot of parseMeetingTimes(c.meets)) {
      const s = toMinutes(slot.start)
      const e = toMinutes(slot.end)
      if (s < start) start = Math.floor(s / 60) * 60
      if (e > end) end = Math.ceil(e / 60) * 60
    }
  }
  return { start, end }
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * The six colours the sheet is drawn from.
 *
 * Passed IN rather than read from the document, so this module stays pure and
 * the layout maths can still be checked without a browser. The caller decides
 * whether that is the app's live theme or the light default below.
 */
export interface SchedulePalette {
  /** The sheet itself. */
  paper: string
  /** Titles, class codes. */
  ink: string
  /** Times, rooms, the day row. */
  inkSoft: string
  /** Hour labels, the footer. */
  inkFaint: string
  /** Hour rules. */
  rule: string
  /** The vertical day separators — one step quieter than the hour rules. */
  ruleSoft: string
}

/** The light sheet, used when no palette is given. */
export const LIGHT_SHEET: SchedulePalette = {
  paper: '#ffffff',
  ink: '#111318',
  inkSoft: '#4b5563',
  inkFaint: '#9ca3af',
  rule: '#e5e7eb',
  ruleSoft: '#eceef1',
}

export interface DrawOptions {
  title: string
  subtitle: string
  /** Fixed hex per course code, so the image matches what is on screen. */
  colorOf: (code: string) => string
  /** Defaults to the light sheet. */
  palette?: SchedulePalette
}

/** Pixel size of the image this data would produce. */
export function imageSize(classes: SharedClass[]): { width: number; height: number } {
  const { start, end } = weekBounds(classes)
  const hours = Math.max(1, Math.round((end - start) / 60))
  return { width: 900, height: PAD * 2 + HEADER + 26 + hours * ROW_H + 30 }
}

export function drawSchedule(
  canvas: HTMLCanvasElement,
  classes: SharedClass[],
  opts: DrawOptions,
): void {
  const { start, end } = weekBounds(classes)
  const hours = Math.max(1, Math.round((end - start) / 60))
  const { width, height } = imageSize(classes)

  // Drawn at 2x and scaled down in CSS, so it is not a blurry mess on a
  // phone screen or when someone zooms into the saved file.
  const dpr = 2
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(dpr, dpr)

  // The sheet used to be light REGARDLESS of the theme, on the reasoning that
  // the PNG leaves the app. That was the wrong half of the trade: what you are
  // looking at nine times out of ten is the preview, inside the app, and a
  // white rectangle dropped into a dark screen reads as a page that failed to
  // load. The palette is the caller's choice now, and the preview hands it the
  // live theme — so the picture you save is the picture you were shown.
  const pal = opts.palette ?? LIGHT_SHEET
  const darkPaper = isDark(pal.paper)

  ctx.fillStyle = pal.paper
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = pal.ink
  ctx.font = '600 22px Inter, system-ui, sans-serif'
  ctx.fillText(opts.title, PAD, PAD + 22)
  ctx.fillStyle = pal.inkSoft
  ctx.font = '400 13px Inter, system-ui, sans-serif'
  ctx.fillText(opts.subtitle, PAD, PAD + 44)

  const gridTop = PAD + HEADER
  const gridLeft = PAD + GUTTER
  const gridW = width - gridLeft - PAD
  const colW = gridW / DAYS.length

  ctx.font = '600 12px Inter, system-ui, sans-serif'
  ctx.fillStyle = pal.inkSoft
  DAYS.forEach((d, i) => {
    ctx.textAlign = 'center'
    ctx.fillText(d, gridLeft + colW * i + colW / 2, gridTop - 8)
  })
  ctx.textAlign = 'left'

  // Hour rules and labels.
  ctx.strokeStyle = pal.rule
  ctx.lineWidth = 1
  ctx.font = '400 11px Inter, system-ui, sans-serif'
  ctx.fillStyle = pal.inkFaint
  for (let h = 0; h <= hours; h++) {
    const y = gridTop + h * ROW_H
    ctx.beginPath()
    ctx.moveTo(gridLeft, y + 0.5)
    ctx.lineTo(gridLeft + gridW, y + 0.5)
    ctx.stroke()
    const label = `${String(Math.floor((start + h * 60) / 60)).padStart(2, '0')}:00`
    ctx.fillText(label, PAD, y + 4)
  }
  ctx.strokeStyle = pal.ruleSoft
  for (let i = 1; i < DAYS.length; i++) {
    const x = gridLeft + colW * i
    ctx.beginPath()
    ctx.moveTo(x + 0.5, gridTop)
    ctx.lineTo(x + 0.5, gridTop + hours * ROW_H)
    ctx.stroke()
  }

  // Blocks.
  for (const c of classes) {
    for (const slot of parseMeetingTimes(c.meets)) {
      const day = slot.day - 1
      if (day < 0 || day > 4) continue
      const top = gridTop + ((toMinutes(slot.start) - start) / 60) * ROW_H
      const h = Math.max(((toMinutes(slot.end) - toMinutes(slot.start)) / 60) * ROW_H, 22)
      const x = gridLeft + colW * day + 3
      const w = colW - 6
      const hex = opts.colorOf(c.code)

      // A 13% wash on a light sheet disappears on a dark one, so the block
      // fill is stronger when the paper is dark.
      ctx.fillStyle = `${hex}${darkPaper ? '3a' : '22'}`
      roundRect(ctx, x, top, w, h, 6)
      ctx.fill()
      ctx.fillStyle = hex
      roundRect(ctx, x, top, 3, h, 1.5)
      ctx.fill()

      ctx.fillStyle = pal.ink
      ctx.font = '600 11.5px Inter, system-ui, sans-serif'
      ctx.fillText(clip(ctx, c.code, w - 14), x + 9, top + 15)
      ctx.fillStyle = pal.inkSoft
      ctx.font = '400 10.5px Inter, system-ui, sans-serif'
      ctx.fillText(clip(ctx, `${slot.start}–${slot.end}`, w - 14), x + 9, top + 28)
      if (h > 42 && c.room) {
        ctx.fillText(clip(ctx, c.room, w - 14), x + 9, top + 40)
      }
    }
  }

  ctx.fillStyle = pal.inkFaint
  ctx.font = '400 10.5px Inter, system-ui, sans-serif'
  ctx.fillText('concordiatracker.com', PAD, height - PAD + 8)
}

/** Truncate to fit, with an ellipsis — a class code running under the next
 *  column is worse than a shortened room number. */
function clip(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let t = text
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1)
  return `${t}…`
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** A stable colour per code, so the same class is the same colour in the image
 *  as it is on the grid the sender was looking at. */
export function colorForCodes(codes: string[]): (code: string) => string {
  const map = new Map<string, string>()
  let i = 0
  for (const c of codes) {
    if (!map.has(c)) map.set(c, COURSE_COLORS[i++ % COURSE_COLORS.length].hex)
  }
  return (code) => map.get(code) ?? '#647084'
}

/** Is this sheet dark? Relative luminance, same rule the theme derivation uses. */
function isDark(hex: string): boolean {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = Number.parseInt(full.slice(0, 6), 16)
  if (!Number.isFinite(n)) return false
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
}
