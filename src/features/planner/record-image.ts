import type { RecordSnapshot } from '@/lib/record-export'

/**
 * Your record, drawn as a PNG.
 *
 * WHY A CANVAS AND NOT A SCREENSHOT OF THE PAGE. The four existing exits each
 * answer a different question: print for an advisor, CSV for a spreadsheet,
 * text for an email, send for a classmate. An image answers "put this in a
 * message or a story", and for that it has to be legible at phone width with
 * no app chrome around it — which a screenshot of a scrolling document is not.
 *
 * Drawn on a LIGHT ground regardless of theme, like the printed sheet and for
 * the same reason: a dark PNG dropped into a light chat is a black rectangle,
 * and this image's whole job is to be looked at somewhere else.
 *
 * Deliberately NOT a transcript. It is stamped, it says self-reported, and it
 * shows the summary plus grades by term — enough to be useful, not enough to
 * be mistaken for a document from the registrar.
 */

const PALETTE = {
  paper: '#ffffff',
  ground: '#f5f6f4',
  ink: '#16181c',
  body: '#43474e',
  subtle: '#767b85',
  line: '#e3e5e8',
  accent: '#46785a',
}

const FONT = "'Hanken Grotesk', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

const PAD = 40
const WIDTH = 900
const HEADER = 150
const TERM_GAP = 26
const ROW = 30
const TERM_HEAD = 38

/** How tall the finished image is. Exported so the caller can size the canvas
 *  before drawing, and so a test can check it grows with the content. */
export function recordImageHeight(snap: RecordSnapshot): number {
  let h = HEADER + PAD
  for (const t of snap.terms) h += TERM_HEAD + t.courses.length * ROW + TERM_GAP
  return Math.max(420, h + 54) // 54 = the stamp line and its breathing room
}

export function drawRecord(
  ctx: CanvasRenderingContext2D,
  snap: RecordSnapshot,
  width = WIDTH,
): void {
  const height = recordImageHeight(snap)

  ctx.fillStyle = PALETTE.ground
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = PALETTE.paper
  roundRect(ctx, 16, 16, width - 32, height - 32, 18)
  ctx.fill()

  const left = PAD
  let y = PAD + 18

  // ── Who ────────────────────────────────────────────────────────────────
  ctx.fillStyle = PALETTE.ink
  ctx.font = `600 27px ${FONT}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(snap.name, left, y + 10)

  ctx.fillStyle = PALETTE.subtle
  ctx.font = `400 14px ${FONT}`
  const sub = [
    snap.handle ? `@${snap.handle}` : null,
    snap.program,
    snap.year ? `Year ${snap.year}` : null,
    snap.minor ? `Minor in ${snap.minor}` : null,
  ]
    .filter(Boolean)
    .join('  ·  ')
  if (sub) ctx.fillText(sub, left, y + 33)

  // ── The three numbers ──────────────────────────────────────────────────
  y += 62
  const stats: [string, string][] = [
    ['Credits', String(snap.credits)],
    ['Courses', String(snap.courseCount)],
    ['GPA', snap.gpa === null ? '—' : snap.gpa.toFixed(2)],
  ]
  let x = left
  for (const [label, value] of stats) {
    ctx.fillStyle = PALETTE.ink
    ctx.font = `600 22px ${FONT}`
    ctx.fillText(value, x, y + 8)
    ctx.fillStyle = PALETTE.subtle
    ctx.font = `500 11px ${FONT}`
    ctx.fillText(label.toUpperCase(), x, y + 26)
    x += 130
  }

  y += 50
  ctx.strokeStyle = PALETTE.line
  ctx.lineWidth = 1
  line(ctx, left, y, width - PAD, y)
  y += TERM_GAP

  // ── Terms, newest first (the snapshot is already ordered) ──────────────
  for (const term of snap.terms) {
    ctx.fillStyle = PALETTE.ink
    ctx.font = `600 15px ${FONT}`
    ctx.fillText(term.term, left, y)
    ctx.fillStyle = PALETTE.subtle
    ctx.font = `400 13px ${FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(`${term.credits} credits`, width - PAD, y)
    ctx.textAlign = 'left'
    y += TERM_HEAD - 14

    for (const c of term.courses) {
      ctx.fillStyle = PALETTE.ink
      ctx.font = `600 13px ${FONT}`
      ctx.fillText(c.code, left, y)

      ctx.fillStyle = PALETTE.body
      ctx.font = `400 13px ${FONT}`
      // The title is the only variable-width thing here, so it is the only
      // thing that gets clipped — a wrapped title would break the row grid.
      ctx.fillText(clip(ctx, c.title ?? '', width - PAD - left - 230), left + 86, y)

      ctx.textAlign = 'right'
      ctx.fillStyle = PALETTE.subtle
      ctx.font = `400 13px ${FONT}`
      ctx.fillText(String(c.credits), width - PAD - 52, y)
      ctx.fillStyle = c.letter ? PALETTE.accent : PALETTE.subtle
      ctx.font = `600 13px ${FONT}`
      ctx.fillText(c.letter ?? '--', width - PAD, y)
      ctx.textAlign = 'left'
      y += ROW
    }
    y += TERM_GAP - 8
  }

  // ── The stamp. A record with no date is a claim about now, forever. ────
  ctx.fillStyle = PALETTE.subtle
  ctx.font = `400 11px ${FONT}`
  ctx.fillText(
    `ConcordiaTracker · ${new Date(snap.generatedAt).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })} · Self-reported, not an official transcript`,
    left,
    height - PAD + 6,
  )
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Cut a title to fit, with an ellipsis, rather than letting it run into the
 *  credits column. Measured, not guessed at a character count. */
function clip(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (!text || ctx.measureText(text).width <= max) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1)
  return `${out}…`
}

export const RECORD_IMAGE_WIDTH = WIDTH
