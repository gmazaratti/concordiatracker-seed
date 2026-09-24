import { forwardRef } from 'react'

/**
 * The sign-in panel's flowing-lines background: two mirrored groups of thin
 * curves, geometry from the 21st.dev FloatingPaths reference.
 *
 * STATIC STROKES, MOVED AS TWO LAYERS. The first version animated every path's
 * stroke-dasharray, dashoffset and opacity with its own CSS animation, about
 * seventy of them. None of those properties is compositable, so the whole SVG
 * was re-rasterised on every frame; on a real laptop that starved the GPU
 * raster and showed up as flicker, half-painted tiles and a dark band that
 * never finished drawing. Now each group is its own `<svg>` (an HTML box, so
 * the browser can promote it to a layer), drawn once, and the only things
 * that change per frame are that layer's `transform` and `opacity`, written by
 * the same requestAnimationFrame loop that floats the cards (useCardFloat).
 * Nothing repaints after the first frame.
 *
 * Fewer paths, too: 14 per group instead of 36. With no per-line animation a
 * denser set only costs raster memory, and 28 lines read as the same sweep.
 *
 * NO LINE CAN DISAPPEAR: every stroke is drawn in full, always. The dashed
 * versions showed only part of each curve, and whenever that part travelled
 * into the section of the curve outside the panel, the line was simply gone.
 * The mirrored group is also offset half a step, because at step 0 the
 * reference formula gives both groups the identical curve.
 *
 * Colour is the accent token (sage on dark, the deeper sage on light); stroke
 * opacity 10 to 35%. Widths are drawing units at roughly 1:1 with the panel's
 * width, so 0.5 to 1px. Inert: pointer-events-none, aria-hidden.
 */
const COUNT = 14
const STEP = 35 / (COUNT - 1) // spread over the reference's 0..35 fan

function paths(position: 1 | -1) {
  return Array.from({ length: COUNT }, (_, n) => {
    const i = n * STEP
    const k = position === 1 ? i : i + STEP / 2
    const x = (v: number) => (v - k * 5 * position).toFixed(1)
    const y = (v: number) => (v - i * 6).toFixed(1)
    const top = (-(189 + i * 6)).toFixed(1)
    const d =
      `M-${x(380)} ${top}C-${x(380)} ${top} -${x(312)} ${y(216)} ${x(152)} ${y(343)}` +
      `C${x(616)} ${y(470)} ${x(684)} ${y(875)} ${x(684)} ${y(875)}`
    return {
      key: `${position}-${n}`,
      d,
      width: 0.5 + (n / (COUNT - 1)) * 0.5,
      opacity: 0.1 + (n / (COUNT - 1)) * 0.25,
    }
  })
}

const GROUPS = [paths(1), paths(-1)]

export const FlowPaths = forwardRef<HTMLDivElement>(function FlowPaths(_, ref) {
  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {GROUPS.map((group, g) => (
        // 24px of bleed on every side so the drift never exposes an edge.
        <svg
          key={g}
          className="absolute -inset-6 h-[calc(100%+48px)] w-[calc(100%+48px)] overflow-visible text-accent will-change-transform"
          viewBox="0 0 696 316"
          fill="none"
        >
          {group.map((p) => (
            <path key={p.key} d={p.d} stroke="currentColor" strokeWidth={p.width} strokeOpacity={p.opacity} />
          ))}
        </svg>
      ))}
    </div>
  )
})
