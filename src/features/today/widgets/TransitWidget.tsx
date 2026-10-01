import { useEffect, useState } from 'react'
import { ArrowLeftRight, TrainFront } from 'lucide-react'
import { cn } from '@/lib/cn'
import { feedExpired, nextDepartures, type StmData } from '@/lib/stm'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * Next STM buses and metros at the stops by campus.
 *
 * The timetable is a static file (public/data/stm-concordia.json, ~24KB
 * gzipped) built once from STM's GTFS feed by scripts/build-stm.mjs and
 * served from the CDN: no function runs and nothing is parsed per request. It
 * is loaded once per session and shared by every copy of the widget.
 *
 * SCHEDULED, NOT LIVE. Real-time positions need an STM developer key; until
 * then this says "scheduled", the same discipline as the shuttle. Past the
 * feed's end date it refuses to show times rather than show stale ones.
 */
const CAMPUS = { sgw: 'SGW', loy: 'Loyola' } as const
type Campus = keyof typeof CAMPUS

let dataCache: StmData | null = null
let inflight: Promise<StmData> | null = null
function loadData(): Promise<StmData> {
  if (dataCache) return Promise.resolve(dataCache)
  inflight ??= fetch('/data/stm-concordia.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((d: StmData) => (dataCache = d))
    .catch((e) => {
      inflight = null
      throw e
    })
  return inflight
}

export function TransitWidget() {
  const [campus, setCampus] = useState<Campus>('sgw')
  const [data, setData] = useState<StmData | null>(dataCache)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let live = true
    loadData()
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true))
    // Minutes-away go stale fast; a 30s tick keeps "in 2 min" honest.
    const t = window.setInterval(() => setNow(new Date()), 30000)
    return () => {
      live = false
      window.clearInterval(t)
    }
  }, [])

  const other: Campus = campus === 'sgw' ? 'loy' : 'sgw'
  const rows = data && !feedExpired(data, now) ? nextDepartures(data, campus, now) : []

  return (
    <WidgetCard
      title="Transit"
      icon={TrainFront}
      action={
        <button
          type="button"
          onClick={() => setCampus(other)}
          aria-label={`Show stops near ${CAMPUS[other]} instead`}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {CAMPUS[campus]}
          <ArrowLeftRight size={11} aria-hidden />
          {CAMPUS[other]}
        </button>
      }
    >
      {!data ? (
        <WidgetEmpty>{failed ? 'The timetable did not load.' : 'Loading timetable…'}</WidgetEmpty>
      ) : feedExpired(data, now) ? (
        <WidgetEmpty>The STM timetable we have ended on its published date and needs updating.</WidgetEmpty>
      ) : rows.length === 0 ? (
        <WidgetEmpty>Nothing scheduled at the stops by campus right now.</WidgetEmpty>
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {rows.map((r) => (
              <li key={`${r.route}-${r.headsign}`} className="flex items-center gap-2.5 px-3.5 py-2">
                <span
                  className={cn(
                    'grid h-6 min-w-[2.25rem] shrink-0 place-items-center rounded px-1 text-[11px] font-bold',
                    r.color ? 'text-white' : 'bg-surface-2 text-fg',
                  )}
                  style={r.color ? { backgroundColor: r.color } : undefined}
                >
                  {r.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-fg">
                    {r.isMetro ? 'to ' : ''}
                    {r.headsign}
                  </p>
                  <p className="truncate text-[11px] text-subtle">{r.stop}</p>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-[13px] font-semibold text-fg tabular-nums">
                    {r.next[0] === 0 ? 'Now' : `${r.next[0]} min`}
                  </span>
                  {r.next[1] !== undefined && (
                    <span className="block text-[11px] text-subtle tabular-nums">then {r.times[1]}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-3.5 py-2 text-[11px] leading-snug text-subtle">Scheduled times from the STM. © STM, CC BY 4.0.</p>
        </>
      )}
    </WidgetCard>
  )
}
