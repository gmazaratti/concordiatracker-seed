import { useState } from 'react'
import { ArrowLeftRight, Bus } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  SHUTTLE_RIDE_MINUTES,
  SHUTTLE_STOPS,
  nextDepartures,
  scheduleValidTo,
  type StopId,
} from '@/data/shuttle'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * Next SGW ↔ Loyola shuttle departures.
 *
 * Says "scheduled", never "arriving" — this is Concordia's published timetable,
 * and their own page notes departures are approximate and that buses leave early
 * once full. Same rule as the provenance badges: state the confidence you have.
 */
export function ShuttleWidget() {
  const [from, setFrom] = useState<StopId>('sgw')
  const now = new Date()
  const { period, next, doneForToday, noServiceToday } = nextDepartures(from, now)
  const to = from === 'sgw' ? 'loy' : 'sgw'

  return (
    <WidgetCard
      title="Shuttle"
      icon={Bus}
      action={
        <button
          type="button"
          onClick={() => setFrom(to)}
          aria-label={`Show departures from ${SHUTTLE_STOPS[to].name} instead`}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          {SHUTTLE_STOPS[from].name}
          <ArrowLeftRight size={11} aria-hidden />
          {SHUTTLE_STOPS[to].name}
        </button>
      }
    >
      {!period ? (
        // Past the last published period. Refuse to guess — a confidently wrong
        // departure time makes someone miss a bus.
        <WidgetEmpty>
          No published schedule for today. The timetable we have runs to{' '}
          {new Date(`${scheduleValidTo()}T12:00`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
          .
        </WidgetEmpty>
      ) : noServiceToday ? (
        <WidgetEmpty>No shuttle today: it runs Monday to Friday.</WidgetEmpty>
      ) : doneForToday ? (
        <WidgetEmpty>Last bus has left for today.</WidgetEmpty>
      ) : (
        <>
          <ul className="divide-y divide-border/60">
            {next.map((d, i) => (
              <li
                key={d.time}
                className={cn(
                  'flex items-baseline gap-2 px-3.5 py-2',
                  i === 0 && 'bg-accent-soft/40',
                )}
              >
                <span
                  className={cn(
                    'text-[14px] font-semibold tabular-nums',
                    i === 0 ? 'text-accent' : 'text-fg',
                  )}
                >
                  {d.time}
                </span>
                <span className="text-[12px] text-subtle">
                  {d.minutes === 0 ? 'now' : `in ${d.minutes} min`}
                </span>
                {i === 0 && (
                  <span className="ml-auto text-[11px] text-subtle">
                    ~{SHUTTLE_RIDE_MINUTES} min ride
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="px-3.5 py-2 text-[11px] leading-snug text-subtle">
            Scheduled times: buses can leave early once full. ID card required.
          </p>
        </>
      )}
    </WidgetCard>
  )
}
