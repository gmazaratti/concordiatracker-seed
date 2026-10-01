import { useEffect, useState } from 'react'
import { SHUTTLE_PERIODS, mergePeriods, type ShuttlePeriod } from '@/data/shuttle'

/**
 * The shuttle timetable: the bundled copy at once, then Concordia's published
 * page (via `/api/shuttle`) merged over it when that answers.
 *
 * The answer is kept on the device for six hours, matching the edge cache, so
 * opening Today repeatedly does not even reach our CDN. Any failure keeps the
 * bundled timetable, which is the whole reason it is bundled.
 */
const KEY = 'ct_shuttle_periods'
const TTL = 6 * 60 * 60 * 1000

function readCache(): ShuttlePeriod[] | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { at: number; periods: ShuttlePeriod[] }
    if (Date.now() - v.at > TTL || !Array.isArray(v.periods)) return null
    return v.periods
  } catch {
    return null
  }
}

function valid(p: unknown): p is ShuttlePeriod[] {
  return (
    Array.isArray(p) &&
    p.length > 0 &&
    p.every(
      (x) =>
        x &&
        typeof x.validFrom === 'string' &&
        typeof x.validTo === 'string' &&
        Array.isArray(x.services) &&
        x.services.every(
          (s: { days?: unknown; departures?: { sgw?: unknown; loy?: unknown } }) =>
            Array.isArray(s.days) && Array.isArray(s.departures?.sgw) && Array.isArray(s.departures?.loy),
        ),
    )
  )
}

export function useShuttlePeriods(): ShuttlePeriod[] {
  const [periods, setPeriods] = useState<ShuttlePeriod[]>(() => {
    const cached = readCache()
    return cached ? mergePeriods(SHUTTLE_PERIODS, cached) : SHUTTLE_PERIODS
  })

  useEffect(() => {
    if (readCache()) return
    let cancelled = false
    fetch('/api/shuttle')
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { periods?: unknown } | null) => {
        if (cancelled || !body || !valid(body.periods)) return
        try {
          localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), periods: body.periods }))
        } catch {
          /* private mode: it just will not persist */
        }
        setPeriods(mergePeriods(SHUTTLE_PERIODS, body.periods))
      })
      .catch(() => {
        /* offline or the page is down: the bundled timetable stands */
      })
    return () => {
      cancelled = true
    }
  }, [])

  return periods
}
