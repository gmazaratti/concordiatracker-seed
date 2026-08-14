/**
 * The Concordia SGW ↔ Loyola shuttle timetable, transcribed from the published
 * schedule at concordia.ca.
 *
 * THIS IS A TIMETABLE, NOT LIVE TRACKING. Concordia's own wording is that
 * departures "are approximate and may vary due to unexpected circumstances,
 * traffic and weather", and that buses leave early once full. So the widget says
 * "scheduled", never "arriving in 3 minutes" — the same discipline as the
 * provenance badges: don't claim more certainty than the source has.
 *
 * EVERY SCHEDULE HAS AN EXPLICIT END DATE. Past `validTo` the widget stops
 * showing times and says the schedule needs updating, rather than confidently
 * announcing a bus that isn't running. A stale timetable is worse than none —
 * somebody misses a bus in February because we were sure.
 *
 * TO UPDATE: replace the periods below from
 * https://www.concordia.ca/campus-life/shuttle-bus.html
 */

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ShuttlePeriod {
  label: string
  /** Inclusive, local dates as YYYY-MM-DD. */
  validFrom: string
  validTo: string
  /** Departure times ("HH:MM", 24h) keyed by the weekdays they apply to. */
  services: { days: Weekday[]; departures: string[] }[]
}

/** Both stops depart at the same clock times; only the origin differs. */
export const SHUTTLE_STOPS = {
  sgw: { id: 'sgw', name: 'SGW', where: 'Hall Building front doors, 1455 De Maisonneuve W.' },
  loy: { id: 'loy', name: 'Loyola', where: 'Loyola Chapel, 7137 Sherbrooke St. W.' },
} as const

export type StopId = keyof typeof SHUTTLE_STOPS

/** Roughly how long the ride takes, per Concordia. */
export const SHUTTLE_RIDE_MINUTES = 30

/** Note the deliberate gaps — there is no 11:30 and no 16:00 departure. */
const FULL_DAY = [
  '09:30', '10:00', '10:30', '11:00',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:30', '17:00', '17:30', '18:00', '18:30',
]

const SUMMER_FRIDAY = [
  '09:30', '10:00', '10:30', '11:00',
  '12:00', '12:30', '13:00', '13:30', '14:00',
]

export const SHUTTLE_PERIODS: ShuttlePeriod[] = [
  {
    label: 'Summer',
    validFrom: '2026-06-08',
    validTo: '2026-08-14',
    services: [
      { days: [1, 2, 3, 4], departures: FULL_DAY },
      { days: [5], departures: SUMMER_FRIDAY },
    ],
  },
  {
    label: 'Late summer',
    validFrom: '2026-08-17',
    validTo: '2026-09-04',
    services: [{ days: [1, 2, 3, 4, 5], departures: FULL_DAY }],
  },
]

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The period covering `now`, or null when we're outside every published one. */
export function periodFor(now: Date): ShuttlePeriod | null {
  const today = ymd(now)
  return SHUTTLE_PERIODS.find((p) => today >= p.validFrom && today <= p.validTo) ?? null
}

/** The last date we have any schedule for — drives the "needs updating" state. */
export function scheduleValidTo(): string {
  return SHUTTLE_PERIODS.reduce((a, p) => (p.validTo > a ? p.validTo : a), '')
}

export interface NextDepartures {
  /** Null when there's no published schedule covering today. */
  period: ShuttlePeriod | null
  /** Empty on weekends, after the last bus, or outside the schedule. */
  next: { time: string; minutes: number }[]
  /** True when today has service but the last bus has already gone. */
  doneForToday: boolean
  /** True when today has no service at all (weekend, or a Friday-less period). */
  noServiceToday: boolean
}

/**
 * The next few departures from a stop.
 *
 * `now` is passed in rather than read here so callers stay pure and testable —
 * the same reason the rest of the app threads the clock explicitly.
 */
export function nextDepartures(stop: StopId, now: Date, count = 3): NextDepartures {
  void stop // both stops share a timetable today; kept so callers read clearly
  const period = periodFor(now)
  if (!period) return { period: null, next: [], doneForToday: false, noServiceToday: false }

  const day = now.getDay() as Weekday
  const service = period.services.find((s) => s.days.includes(day))
  if (!service) {
    return { period, next: [], doneForToday: false, noServiceToday: true }
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const upcoming = service.departures
    .map((time) => {
      const [h, m] = time.split(':').map(Number)
      return { time, minutes: h * 60 + m - minutesNow }
    })
    .filter((d) => d.minutes >= 0)
    .slice(0, count)

  return {
    period,
    next: upcoming,
    doneForToday: upcoming.length === 0,
    noServiceToday: false,
  }
}
