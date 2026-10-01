/**
 * Next STM buses and metros at the stops by each campus.
 *
 * Reads public/data/stm-concordia.json, which scripts/build-stm.mjs extracts
 * once from STM's static GTFS feed (CC BY 4.0). This is the SCHEDULE, not live
 * positions: real-time needs an STM developer key (a manual signup), so the
 * widget says "scheduled".
 *
 * PURE and import-free: tested in stm.test.mjs. Times past midnight follow the
 * GTFS rule: a trip that starts at 23:50 and reaches campus at 24:10 belongs
 * to YESTERDAY's service day, so yesterday's services are checked too.
 */

export interface StmData {
  feed: { start: string; end: string; version?: string }
  stops: { id: string; name: string; campus: 'sgw' | 'loy'; m: number }[]
  routes: Record<string, { n: string; name: string; c: string | null; t: number }>
  services: Record<string, { days: string; start: string; end: string; add: string[]; remove: string[] }>
  lines: { stop: string; route: string; headsign: string; svc: Record<string, number[]> }[]
}

export interface StmDeparture {
  route: string
  /** "24", or "Green" for metro line 1. */
  label: string
  isMetro: boolean
  color: string | null
  headsign: string
  stop: string
  /** Minutes from now, for the next two departures. */
  next: number[]
  /** Clock times ("HH:MM") of the same departures. */
  times: string[]
}

const METRO_NAMES: Record<string, string> = { '1': 'Green', '2': 'Orange', '4': 'Yellow', '5': 'Blue' }

const gtfsDate = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

export function serviceRuns(s: StmData['services'][string], day: Date): boolean {
  const key = gtfsDate(day)
  if (s.remove.includes(key)) return false
  if (s.add.includes(key)) return true
  return key >= s.start && key <= s.end && s.days[day.getDay()] === '1'
}

/** Past the feed's end date the timetable is stale and must not be shown. */
export function feedExpired(data: StmData, now: Date): boolean {
  return gtfsDate(now) > data.feed.end
}

const clock = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/**
 * The next departures near a campus, one row per route and direction (a
 * route's two paired stops count once), soonest first.
 */
export function nextDepartures(data: StmData, campus: 'sgw' | 'loy', now: Date, rowsWanted = 6): StmDeparture[] {
  const stopsHere = new Map(data.stops.filter((s) => s.campus === campus).map((s) => [s.id, s]))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const runsToday = new Set(Object.keys(data.services).filter((id) => serviceRuns(data.services[id], today)))
  const runsYesterday = new Set(Object.keys(data.services).filter((id) => serviceRuns(data.services[id], yesterday)))
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const minutesFor = (line: StmData['lines'][number]) => {
    const mins: number[] = []
    for (const [svc, times] of Object.entries(line.svc)) {
      if (runsToday.has(svc)) for (const t of times) if (t >= nowMin) mins.push(t - nowMin)
      if (runsYesterday.has(svc)) for (const t of times) if (t >= 1440 && t - 1440 >= nowMin) mins.push(t - 1440 - nowMin)
    }
    return mins
  }

  // ONE STOP PER ROUTE AND DIRECTION: the closest one to campus that has
  // service. A bus along Sherbrooke passes three stops by SGW a minute apart,
  // and merging them listed the same bus three times.
  const groups = new Map<string, { line: StmData['lines'][number]; mins: number[]; m: number }>()
  for (const line of data.lines) {
    const stop = stopsHere.get(line.stop)
    if (!stop) continue
    const mins = minutesFor(line)
    if (mins.length === 0) continue
    const key = `${line.route}|${line.headsign}`
    const g = groups.get(key)
    if (!g || stop.m < g.m) groups.set(key, { line, mins, m: stop.m })
  }

  return [...groups.values()]
    .map(({ line, mins }) => {
      const next = [...new Set(mins)].sort((a, b) => a - b).slice(0, 2)
      const r = data.routes[line.route]
      const isMetro = r?.t === 1
      return {
        route: line.route,
        label: isMetro ? (METRO_NAMES[line.route] ?? r?.n ?? line.route) : (r?.n ?? line.route),
        isMetro,
        color: r?.c ? `#${r.c}` : null,
        headsign: line.headsign,
        stop: stopsHere.get(line.stop)?.name ?? '',
        next,
        times: next.map((m) => clock(nowMin + m)),
      }
    })
    .sort((a, b) => a.next[0] - b.next[0])
    .slice(0, rowsWanted)
}
