import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/cn'

export interface Point {
  /** ISO date, one per calendar day including days with nothing in them. */
  day: string
  value: number
}

/**
 * One series over time, drawn by hand.
 *
 * ONE SERIES, DELIBERATELY. The layout this is modelled on shows two lines on
 * one axis; two measures of different scale on one y-axis is the single most
 * common charting mistake, and revenue-in-dollars beside signups-in-people is
 * exactly that case. The metric is a toggle instead, and the comparison with
 * the previous period is a percentage on the card rather than a second line.
 *
 * That also settles the colour question: a lone series needs no categorical
 * palette and no legend — the title names it. The validator rejected the
 * accent-plus-grey pair anyway at ΔE 12.3, under the 15 floor, meaning even
 * full-colour readers would struggle to tell the two lines apart.
 *
 * No chart library. This is a path, an area, a baseline and a crosshair; the
 * repo has kept one runtime dependency on purpose and a chart is not a reason
 * to add a second.
 */
export function AreaChart({
  points,
  format,
  label,
  height = 200,
  className,
}: {
  points: Point[]
  /** How a value reads in the tooltip — dollars, people, whatever. */
  format: (n: number) => string
  label: string
  height?: number
  className?: string
}) {
  const gradId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  // A fixed viewBox with preserveAspectRatio="none" lets the SVG stretch to
  // any container width while the maths stays in one coordinate system.
  const W = 600
  const H = height
  const PAD_T = 12
  const PAD_B = 22
  // A left gutter for the scale. Without it the first data point sits at x=0
  // and the axis labels print on top of the line -- seen on screen.
  const PAD_L = 46

  if (points.length === 0) {
    return (
      <div className={cn('grid place-items-center text-[12.5px] text-subtle', className)} style={{ height }}>
        Nothing to plot yet.
      </div>
    )
  }

  const max = Math.max(1, ...points.map((p) => p.value))
  const plotW = W - PAD_L
  const stepX = points.length > 1 ? plotW / (points.length - 1) : plotW
  const y = (v: number) => PAD_T + (1 - v / max) * (H - PAD_T - PAD_B)
  const x = (i: number) => PAD_L + i * stepX

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H - PAD_B} L${PAD_L},${H - PAD_B} Z`

  // Four gridlines, recessive. Enough to read a level off, few enough that the
  // data stays the loudest thing in the frame.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ f, v: max * (1 - f) }))

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    // Measured across the plot area, not the element: the gutter would
    // otherwise shift every reading left by its width.
    const gutter = (PAD_L / W) * box.width
    const ratio = Math.min(1, Math.max(0, (e.clientX - box.left - gutter) / (box.width - gutter)))
    setHover(Math.round(ratio * (points.length - 1)))
  }

  const hp = hover != null ? points[hover] : null

  return (
    <div
      ref={wrapRef}
      className={cn('relative', className)}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`${label} over the last ${points.length} days`}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--ct-accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--ct-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <line
            key={t.f}
            x1={PAD_L}
            x2={W}
            y1={PAD_T + t.f * (H - PAD_T - PAD_B)}
            y2={PAD_T + t.f * (H - PAD_T - PAD_B)}
            stroke="var(--ct-border)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={area} fill={`url(#${gradId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--ct-accent)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          // Without this the horizontal stretch would thin the stroke.
          vectorEffect="non-scaling-stroke"
          className="ct-chart-line"
          style={{ ['--len' as string]: '2000' }}
        />

        {hover != null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD_T}
              y2={H - PAD_B}
              stroke="var(--ct-accent)"
              strokeWidth="1"
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={x(hover)}
              cy={y(points[hover].value)}
              r="4"
              fill="var(--ct-accent)"
              stroke="var(--ct-surface)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>

      {/* The scale, as text rather than an SVG axis, so it never stretches. */}
      <div
        className="pointer-events-none absolute top-0 left-0 flex flex-col justify-between pr-2 text-right text-[10px] tabular-nums text-subtle"
        style={{ width: `${(PAD_L / W) * 100}%`, height: height - PAD_B + 6, paddingTop: 6 }}
        aria-hidden
      >
        <span>{format(max)}</span>
        <span>{format(max / 2)}</span>
        <span>{format(0)}</span>
      </div>

      <div
        className="mt-1 flex justify-between text-[10.5px] text-subtle"
        style={{ marginLeft: `${(PAD_L / W) * 100}%` }}
        aria-hidden
      >
        <span>{shortDay(points[0].day)}</span>
        {points.length > 2 && <span>{shortDay(points[Math.floor(points.length / 2)].day)}</span>}
        <span>{shortDay(points[points.length - 1].day)}</span>
      </div>

      {hp && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg border border-border bg-surface px-2.5 py-1.5 shadow-lg"
          style={{
            left: `${((PAD_L + (hover! / Math.max(1, points.length - 1)) * plotW) / W) * 100}%`,
          }}
        >
          <p className="text-[13px] font-semibold text-fg tabular-nums">{format(hp.value)}</p>
          <p className="text-[10.5px] whitespace-nowrap text-subtle">{longDay(hp.day)}</p>
        </div>
      )}
    </div>
  )
}

/** A compact trend, no axes — the small cards at the bottom of the layout. */
export function Sparkline({ points, height = 40 }: { points: Point[]; height?: number }) {
  if (points.length < 2) return <div style={{ height }} />
  const W = 120
  const max = Math.max(1, ...points.map((p) => p.value))
  const step = W / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - (p.value / max) * (height - 4) - 2).toFixed(1)}`)
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <path
        d={`${d} L${W},${height} L0,${height} Z`}
        fill="var(--ct-accent)"
        opacity="0.14"
      />
      <path d={d} fill="none" stroke="var(--ct-accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const shortDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
const longDay = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
