import { useEffect, useState } from 'react'
import { Library } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { WidgetZone } from './registry'

/**
 * How busy the libraries are, right now.
 *
 * Concordia counts people through the gates and publishes it; nothing else on
 * campus tells a student whether it is worth the walk to Webster at 7pm in
 * November. Its own widget rather than a page, because the whole question is
 * answered by one number and you want it in passing.
 *
 * The honesty rule this needs: Grey Nuns' sensor reports zero with a timestamp
 * from 1900, which is a sensor that has never spoken rather than an empty
 * library. The route marks those stale and this shows a dash — a confident "0
 * people" about a building someone might walk to is exactly the wrong answer.
 */
interface Row {
  id: string
  name: string
  people: number | null
  ageMinutes: number | null
  stale: boolean
}

/**
 * Rough capacities, used ONLY to colour the bar.
 *
 * Concordia does not publish a capacity, so these are order-of-magnitude
 * anchors from the published counts, not facts — which is why the number of
 * PEOPLE is what is shown and the busy-ness is only ever a bar and a word.
 * Nothing here claims a percentage.
 */
const ROUGH_CAPACITY: Record<string, number> = { Webster: 900, Vanier: 350, GreyNuns: 300 }

export function LibraryWidget({ zone }: { zone: WidgetZone }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () => {
      fetch('/api/library')
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { libraries: Row[] }) => {
          if (alive) {
            setRows(d.libraries)
            setFailed(false)
          }
        })
        .catch(() => alive && setFailed(true))
    }
    load()
    // Refreshed when you come back to the tab rather than on a timer: the
    // sensor updates every fifteen minutes or so, and polling a shared quota
    // for a widget nobody is looking at is rude to the seat watcher.
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  /**
   * Only branches that actually report.
   *
   * The feed lists Grey Nuns, but its LastRecordTime is 1900-01-01 — there is no
   * gate counter there and there never has been. A permanent dash is not data,
   * it is a row that makes the widget look broken, so a branch with no reading
   * in the last day is not listed at all. If Concordia ever wires that sensor
   * up, it appears on its own with no change here.
   */
  const shown = (rows ?? []).filter((r) => r.ageMinutes !== null && r.ageMinutes < 60 * 24)

  return (
    <div className={cn('rounded-xl border border-border bg-surface p-3', zone === 'rail' && 'p-2.5')}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <Library size={12} aria-hidden />
        In the library now
      </p>

      {failed && (
        <p className="mt-2 text-[12px] text-subtle">
          Concordia&rsquo;s counter is not answering. It comes back on its own.
        </p>
      )}

      {!failed && rows === null && (
        <div className="mt-2 space-y-2" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="ct-shimmer h-6 rounded bg-surface-2" />
          ))}
        </div>
      )}

      {!failed && rows !== null && shown.length === 0 && (
        <p className="mt-2 text-[12px] text-subtle">No counts published right now.</p>
      )}

      <ul
        className={cn(
          'mt-2 space-y-2',
          // Two reporting branches is the whole set, so they sit side by side
          // wherever there is room rather than stacking and wasting a row.
          zone !== 'rail' && 'sm:grid sm:grid-cols-2 sm:gap-x-4 sm:gap-y-2 sm:space-y-0',
        )}
      >
        {shown.map((r) => {
          const cap = ROUGH_CAPACITY[r.id] ?? 500
          const pct = r.people === null ? 0 : Math.min(100, Math.round((r.people / cap) * 100))
          return (
            <li key={r.id}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[12px] text-fg">{r.name}</span>
                <span
                  className={cn(
                    'shrink-0 text-[12px] font-medium tabular-nums',
                    r.people === null ? 'text-subtle' : 'text-fg',
                  )}
                >
                  {r.people === null ? '—' : r.people}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-500',
                    r.people === null
                      ? 'bg-border'
                      : pct > 75
                        ? 'bg-warning'
                        : pct > 40
                          ? 'bg-accent'
                          : 'bg-success',
                  )}
                  style={{ width: `${r.people === null ? 0 : Math.max(pct, 3)}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10.5px] text-subtle">
                {r.people === null
                  ? 'No recent count from this branch'
                  : describeAge(r.ageMinutes)}
              </p>
            </li>
          )
        })}
      </ul>

      {shown.some((r) => r.people !== null) && (
        <p className="mt-2 border-t border-border pt-1.5 text-[10.5px] leading-relaxed text-subtle">
          People counted through the gates, from Concordia&rsquo;s own sensors. The bar is a rough
          sense of busy, not a seat count.
        </p>
      )}
    </div>
  )
}

function describeAge(minutes: number | null): string {
  if (minutes === null) return 'Just now'
  if (minutes <= 1) return 'Counted a moment ago'
  if (minutes < 60) return `Counted ${minutes} min ago`
  const h = Math.round(minutes / 60)
  return `Counted ${h} hour${h === 1 ? '' : 's'} ago`
}
