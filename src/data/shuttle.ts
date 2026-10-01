/**
 * The Concordia SGW ↔ Loyola shuttle timetable.
 *
 * WHERE IT COMES FROM. The widget reads Concordia's published page
 * (https://www.concordia.ca/maps/shuttle-bus.html) through `/api/shuttle`,
 * which parses it with lib/shuttle-parse.ts and is cached at the edge for six
 * hours, so a new term's timetable shows up on its own. The periods below are
 * the BUNDLED COPY: what the widget shows before that answer arrives, offline,
 * or if the page ever changes shape and parses to nothing. They were last
 * taken from the page on 2026-10-01; refresh them when convenient, but the
 * widget no longer depends on it.
 *
 * THIS IS A TIMETABLE, NOT LIVE TRACKING. Concordia's own wording is that
 * departures "are approximate and may vary due to unexpected circumstances,
 * traffic and weather", and that buses leave early once full. So the widget says
 * "scheduled", never "arriving in 3 minutes". (Concordia's tracker has an
 * undocumented GPS backend; it is deliberately not used.)
 *
 * EVERY SCHEDULE HAS AN EXPLICIT END DATE. Past `validTo` the widget stops
 * showing times and says so, rather than confidently announcing a bus that
 * isn't running.
 */

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface ShuttlePeriod {
  label: string
  /** Inclusive, local dates as YYYY-MM-DD. */
  validFrom: string
  validTo: string
  /** Departure times ("HH:MM", 24h) per stop, keyed by the weekdays they apply
   *  to. The two stops do not share times: Loyola leaves on the quarter hour
   *  SGW is still waiting for its bus to arrive. */
  services: { days: Weekday[]; departures: { sgw: string[]; loy: string[] } }[]
}

export const SHUTTLE_STOPS = {
  sgw: { id: 'sgw', name: 'SGW', where: 'Hall Building front doors, 1455 De Maisonneuve W.' },
  loy: { id: 'loy', name: 'Loyola', where: 'Loyola Chapel, 7137 Sherbrooke St. W.' },
} as const

export type StopId = keyof typeof SHUTTLE_STOPS

/** Roughly how long the ride takes, per Concordia. */
export const SHUTTLE_RIDE_MINUTES = 30

const both = (times: string[]) => ({ sgw: times, loy: times })

/** Summer periods had one shared list for both stops. */
const SUMMER_DAY = [
  '09:30', '10:00', '10:30', '11:00', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:30', '17:00', '17:30', '18:00', '18:30',
]
const SUMMER_FRIDAY = ['09:30', '10:00', '10:30', '11:00', '12:00', '12:30', '13:00', '13:30', '14:00']

export const SHUTTLE_PERIODS: ShuttlePeriod[] = [
  {
    label: 'Summer',
    validFrom: '2026-06-08',
    validTo: '2026-08-14',
    services: [
      { days: [1, 2, 3, 4], departures: both(SUMMER_DAY) },
      { days: [5], departures: both(SUMMER_FRIDAY) },
    ],
  },
  {
    label: 'Late summer',
    validFrom: '2026-08-17',
    validTo: '2026-09-04',
    services: [{ days: [1, 2, 3, 4, 5], departures: both(SUMMER_DAY) }],
  },
  {
    label: 'Fall',
    validFrom: '2026-09-08',
    validTo: '2026-10-09',
    services: [
      {
        days: [1, 2, 3, 4],
        departures: {
          loy: [
            '09:15', '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30',
            '11:45', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30',
            '14:45', '15:00', '15:15', '15:30', '15:45', '16:30', '16:45', '17:00', '17:15', '17:30',
            '17:45', '18:00', '18:15', '18:30',
          ],
          sgw: [
            '09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '12:15',
            '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45',
            '15:00', '15:15', '15:30', '16:00', '16:15', '16:45', '17:00', '17:15', '17:30', '17:45',
            '18:00', '18:15', '18:30',
          ],
        },
      },
      {
        days: [5],
        departures: {
          loy: [
            '09:15', '09:30', '09:45', '10:15', '10:45', '11:00', '11:15', '12:00', '12:15', '12:45',
            '13:00', '13:15', '13:45', '14:15', '14:30', '14:45', '15:15', '15:30', '15:45', '16:45',
            '17:15', '17:45', '18:15',
          ],
          sgw: [
            '09:45', '10:00', '10:15', '10:45', '11:15', '11:30', '12:15', '12:30', '12:45', '13:15',
            '13:45', '14:00', '14:15', '14:45', '15:00', '15:15', '15:45', '16:00', '16:45', '17:15',
            '17:45', '18:15',
          ],
        },
      },
    ],
  },
  {
    // No service on Monday, October 12 (Thanksgiving): Tuesday to Friday only.
    label: 'Reading Week',
    validFrom: '2026-10-13',
    validTo: '2026-10-16',
    services: [
      {
        days: [2, 3, 4, 5],
        departures: {
          loy: [
            '09:15', '09:45', '10:15', '11:15', '11:45', '12:15', '12:45', '13:15', '13:45', '14:15',
            '14:45', '15:15', '15:45', '16:15', '16:45', '17:45', '18:15', '18:45',
          ],
          sgw: [
            '09:15', '09:45', '10:15', '10:45', '11:45', '12:15', '12:45', '13:15', '13:45', '14:15',
            '14:45', '15:15', '15:45', '16:15', '17:15', '17:45', '18:15', '18:45',
          ],
        },
      },
    ],
  },
]

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * The published periods merged over the bundled ones. A fetched period wins
 * over a bundled one covering the same dates; bundled periods the page no
 * longer lists (it only shows current and upcoming terms) are kept.
 */
export function mergePeriods(bundled: ShuttlePeriod[], fetched: ShuttlePeriod[]): ShuttlePeriod[] {
  const overlaps = (a: ShuttlePeriod, b: ShuttlePeriod) => a.validFrom <= b.validTo && b.validFrom <= a.validTo
  const kept = bundled.filter((b) => !fetched.some((f) => overlaps(f, b)))
  return [...kept, ...fetched].sort((a, b) => a.validFrom.localeCompare(b.validFrom))
}

/** The period covering `now`, or null when we're outside every published one. */
export function periodFor(now: Date, periods: ShuttlePeriod[] = SHUTTLE_PERIODS): ShuttlePeriod | null {
  const today = ymd(now)
  return periods.find((p) => today >= p.validFrom && today <= p.validTo) ?? null
}

/** The last date we have any schedule for — drives the "no schedule" state. */
export function scheduleValidTo(periods: ShuttlePeriod[] = SHUTTLE_PERIODS): string {
  return periods.reduce((a, p) => (p.validTo > a ? p.validTo : a), '')
}

/** The next period that has not started yet, for "next schedule starts …". */
export function nextPeriod(now: Date, periods: ShuttlePeriod[] = SHUTTLE_PERIODS): ShuttlePeriod | null {
  const today = ymd(now)
  return [...periods].filter((p) => p.validFrom > today).sort((a, b) => a.validFrom.localeCompare(b.validFrom))[0] ?? null
}

export interface NextDepartures {
  /** Null when there's no published schedule covering today. */
  period: ShuttlePeriod | null
  /** Empty on weekends, after the last bus, or outside the schedule. */
  next: { time: string; minutes: number }[]
  /** True when today has service but the last bus has already gone. */
  doneForToday: boolean
  /** True when today has no service at all (weekend, or a day the period skips). */
  noServiceToday: boolean
}

/**
 * The next few departures from a stop.
 *
 * `now` is passed in rather than read here so callers stay pure and testable —
 * the same reason the rest of the app threads the clock explicitly.
 */
export function nextDepartures(
  stop: StopId,
  now: Date,
  count = 3,
  periods: ShuttlePeriod[] = SHUTTLE_PERIODS,
): NextDepartures {
  const period = periodFor(now, periods)
  if (!period) return { period: null, next: [], doneForToday: false, noServiceToday: false }

  const day = now.getDay() as Weekday
  const service = period.services.find((s) => s.days.includes(day))
  if (!service) {
    return { period, next: [], doneForToday: false, noServiceToday: true }
  }

  const minutesNow = now.getHours() * 60 + now.getMinutes()
  const upcoming = service.departures[stop]
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
