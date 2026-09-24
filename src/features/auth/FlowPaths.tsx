/**
 * The sign-in panel's flowing-lines background: two mirrored groups of 36
 * thin curves, each drawing in, drifting along itself and gently pulsing, on
 * its own 20 to 30s loop.
 *
 * A CSS recreation of a framer-motion reference (framer-motion is not a
 * dependency here and is not being added for a background). The geometry is
 * the reference's own formula. Each path carries `pathLength="1"`, so the
 * `ct-flow` keyframes in index.css can express framer's pathLength and
 * pathOffset directly as dasharray and dashoffset fractions.
 *
 * NEVER IN SYNC: every path has its own duration and a negative delay, both
 * derived from its index rather than Math.random (a render must stay pure),
 * so the loops start mid-flight and never line up.
 *
 * Colour is the accent token, so it is sage on dark and the deeper sage on
 * light; stroke opacity runs 10 to 35% and the keyframes pulse it between half
 * and full of that. The drawing is fitted to the panel's width (about 1:1)
 * and allowed to overflow its viewBox, which is how the curves reach the top
 * and bottom of a tall panel; the wrapper clips them. Widths are drawing units
 * and land at 0.5 to 1px. NOT `non-scaling-stroke`: Chrome then measures the
 * dash pattern in screen pixels, ignores pathLength, and every line collapses
 * into a sub-pixel dot. The layer is inert: pointer-events-none, aria-hidden,
 * behind the content.
 */
const COUNT = 36

function paths(position: 1 | -1) {
  return Array.from({ length: COUNT }, (_, i) => {
    const x = (n: number) => n - i * 5 * position
    const d =
      `M${-x(380)} ${-(189 + i * 6)}` +
      `C${-x(380)} ${-(189 + i * 6)} ${-x(312)} ${216 - i * 6} ${x(152)} ${343 - i * 6}` +
      `C${x(616)} ${470 - i * 6} ${x(684)} ${875 - i * 6} ${x(684)} ${875 - i * 6}`
    // Deterministic spread over 20-30s, different for the two groups.
    const duration = 20 + (((i * 37 + (position === 1 ? 0 : 19)) % 100) / 10)
    const delay = -(((i * 53 + (position === 1 ? 7 : 41)) % 100) / 100) * duration
    return {
      key: `${position}-${i}`,
      d,
      width: 0.5 + (i / (COUNT - 1)) * 0.5,
      opacity: 0.1 + (i / (COUNT - 1)) * 0.25,
      duration,
      delay,
    }
  })
}

const ALL = [...paths(1), ...paths(-1)]

export function FlowPaths() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <svg
        className="h-full w-full overflow-visible text-accent"
        viewBox="0 0 696 316"
        fill="none"
      >
        {ALL.map((p) => (
          <path
            key={p.key}
            d={p.d}
            pathLength={1}
            stroke="currentColor"
            strokeWidth={p.width}
            strokeOpacity={p.opacity}
            className="ct-flow"
            style={{ animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }}
          />
        ))}
      </svg>
    </div>
  )
}
