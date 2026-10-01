import { useEffect, useState } from 'react'
import { ArrowLeftRight, Bike } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  CAMPUS_POINTS,
  nearestStations,
  readStations,
  type CampusId,
  type NearbyStation,
  type StationInfo,
  type StationReading,
  type StationStatus,
} from '@/lib/bixi'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * Bikes and free docks at the BIXI stations nearest each campus.
 *
 * FETCHED FROM THE BROWSER, never through our server: BIXI's feed sends
 * `Access-Control-Allow-Origin: *`, so this costs Vercel nothing.
 *
 * KEPT CHEAP FOR THE PHONE TOO. The status file is ~300KB uncompressed, so it
 * is fetched at most once a minute per device (the feed updates every 10s;
 * a minute is plenty for "is there a bike"), only while the tab is visible,
 * and the answer is shared by every copy of the widget. The station list
 * (~380KB) is fetched once a day and only the handful of stations near the
 * two campuses is kept.
 */
const BASE = 'https://gbfs.velobixi.com/gbfs/en'
const NEARBY_KEY = 'ct_bixi_nearby'
const DAY = 24 * 60 * 60 * 1000
const MINUTE = 60 * 1000

type NearbyByCampus = Record<CampusId, NearbyStation[]>

let statusCache: { at: number; stations: StationStatus[] } | null = null
let statusInflight: Promise<StationStatus[]> | null = null

function getStatus(): Promise<StationStatus[]> {
  if (statusCache && Date.now() - statusCache.at < MINUTE) return Promise.resolve(statusCache.stations)
  statusInflight ??= fetch(`${BASE}/station_status.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { data?: { stations?: StationStatus[] } }) => {
      const stations = j.data?.stations ?? []
      statusCache = { at: Date.now(), stations }
      return stations
    })
    .finally(() => {
      statusInflight = null
    })
  return statusInflight
}

function readNearby(): NearbyByCampus | null {
  try {
    const raw = localStorage.getItem(NEARBY_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { at: number; nearby: NearbyByCampus }
    return Date.now() - v.at < DAY ? v.nearby : null
  } catch {
    return null
  }
}

async function getNearby(): Promise<NearbyByCampus> {
  const cached = readNearby()
  if (cached) return cached
  const r = await fetch(`${BASE}/station_information.json`)
  if (!r.ok) throw new Error(String(r.status))
  const j = (await r.json()) as { data?: { stations?: StationInfo[] } }
  const all = j.data?.stations ?? []
  const nearby: NearbyByCampus = {
    sgw: nearestStations(all, CAMPUS_POINTS.sgw.lat, CAMPUS_POINTS.sgw.lon),
    loy: nearestStations(all, CAMPUS_POINTS.loy.lat, CAMPUS_POINTS.loy.lon),
  }
  try {
    localStorage.setItem(NEARBY_KEY, JSON.stringify({ at: Date.now(), nearby }))
  } catch {
    /* private mode */
  }
  return nearby
}

export function BixiWidget() {
  const [campus, setCampus] = useState<CampusId>('sgw')
  const [nearby, setNearby] = useState<NearbyByCampus | null>(() => readNearby())
  const [status, setStatus] = useState<StationStatus[] | null>(() => statusCache?.stations ?? null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      Promise.all([getNearby(), getStatus()])
        .then(([n, s]) => {
          if (!live) return
          setNearby(n)
          setStatus(s)
          setFailed(false)
        })
        .catch(() => {
          if (live) setFailed(true)
        })
    }
    refresh()
    const timer = window.setInterval(refresh, MINUTE)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      live = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const other: CampusId = campus === 'sgw' ? 'loy' : 'sgw'
  const readings: StationReading[] = nearby && status ? readStations(nearby[campus], status) : []

  return (
    <WidgetCard
      title="BIXI"
      icon={Bike}
      action={
        <button
          type="button"
          onClick={() => setCampus(other)}
          aria-label={`Show stations near ${CAMPUS_POINTS[other].name} instead`}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {CAMPUS_POINTS[campus].name}
          <ArrowLeftRight size={11} aria-hidden />
          {CAMPUS_POINTS[other].name}
        </button>
      }
    >
      {readings.length === 0 ? (
        <WidgetEmpty>{failed ? 'BIXI is not answering right now.' : status ? 'No stations near this campus right now.' : 'Loading stations…'}</WidgetEmpty>
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {readings.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3.5 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-fg">{s.name}</p>
                  <p className="text-[11px] text-subtle">{s.meters} m from campus</p>
                </div>
                {s.closed ? (
                  <span className="text-[11px] text-subtle">Closed</span>
                ) : (
                  <div className="flex shrink-0 gap-3 text-right">
                    <Count n={s.bikes} label={s.ebikes > 0 ? `bikes · ${s.ebikes} e` : 'bikes'} />
                    <Count n={s.docks} label="docks" />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="px-3.5 py-2 text-[11px] leading-snug text-subtle">Live from BIXI, refreshed every minute.</p>
        </>
      )}
    </WidgetCard>
  )
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className="block min-w-[2.75rem]">
      <span className={cn('block text-[14px] font-semibold tabular-nums', n === 0 ? 'text-subtle' : 'text-fg')}>{n}</span>
      <span className="block text-[11px] whitespace-nowrap text-subtle">{label}</span>
    </span>
  )
}
