import { useState } from 'react'

const DAY = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' })

/**
 * Succeeded and failed parses per day, stacked.
 *
 * Status colours are the right encoding here because the two series ARE
 * states — and they carry a legend and a label in the tooltip, never colour
 * alone. Thin bars, a 2px gap between the two segments, rounded tops only.
 */
export function ParseDailyChart({ series }: { series: { day: string; ok: number; failed: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  if (series.length === 0) return <p className="px-4 py-6 text-[13px] text-subtle">No parses in this range.</p>
  const max = Math.max(1, ...series.map((d) => d.ok + d.failed))
  const H = 140
  const h = hover == null ? null : series[hover]
  const label = (d: string) => DAY.format(new Date(`${d}T12:00:00`))

  return (
    <div className="px-4 pt-3 pb-4">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-success" aria-hidden /> Succeeded
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-danger" aria-hidden /> Failed or never finished
        </span>
        <span className="ml-auto min-h-[18px] tabular-nums text-fg" aria-live="polite">
          {h ? `${label(h.day)} · ${h.ok} succeeded · ${h.failed} failed` : `Peak ${max} in a day`}
        </span>
      </div>
      <div className="relative" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" aria-hidden />
        <div className="flex h-full items-end" role="list" aria-label="Parses per day">
          {series.map((d, i) => {
            const okH = (d.ok / max) * (H - 4)
            const badH = (d.failed / max) * (H - 4)
            return (
              <div
                key={d.day}
                role="listitem"
                aria-label={`${label(d.day)}: ${d.ok} succeeded, ${d.failed} failed`}
                onMouseEnter={() => setHover(i)}
                className="flex h-full min-w-0 flex-1 flex-col items-center justify-end px-[1px]"
              >
                <div className={i === hover ? 'flex w-full max-w-[14px] flex-col gap-[2px] opacity-100' : 'flex w-full max-w-[14px] flex-col gap-[2px] opacity-90'}>
                  {d.failed > 0 && <div className="w-full rounded-t-[4px] bg-danger" style={{ height: Math.max(2, badH) }} />}
                  {d.ok > 0 && (
                    <div
                      className={d.failed > 0 ? 'w-full bg-success' : 'w-full rounded-t-[4px] bg-success'}
                      style={{ height: Math.max(2, okH) }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-subtle tabular-nums">
        <span>{label(series[0].day)}</span>
        <span>{label(series[series.length - 1].day)}</span>
      </div>
    </div>
  )
}
