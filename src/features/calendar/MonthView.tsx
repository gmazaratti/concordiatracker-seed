import type { Course } from '@/data/types'
import type { CalendarPrefs } from '@/app/providers/app-data'
import { cn } from '@/lib/cn'
import {
  WEEKDAYS,
  dayItems,
  monthGrid,
  sameDay,
  ymd,
  type CalendarSource,
} from './calendar'
import { EventPill } from './EventPill'

const MAX_PILLS = 3

/** The month grid — a calm 6×7 board. Each day is a button that opens the day
 * detail; pills inside are a glanceable preview (overdue assignments read red). */
export function MonthView({
  view,
  source,
  prefs,
  courseById,
  onOpenDay,
}: {
  view: Date
  source: CalendarSource
  prefs: CalendarPrefs
  courseById: (id: string) => Course | undefined
  onOpenDay: (day: Date) => void
}) {
  const days = monthGrid(view)
  const today = new Date()
  const month = view.getMonth()

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border bg-surface-2/40">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-semibold tracking-wide text-subtle uppercase"
          >
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const items = dayItems(day, source, prefs)
          const inMonth = day.getMonth() === month
          const isToday = sameDay(day, today)
          const extra = items.length - MAX_PILLS

          return (
            <button
              key={ymd(day)}
              type="button"
              onClick={() => onOpenDay(day)}
              aria-label={`${day.toDateString()}, ${items.length} item${items.length === 1 ? '' : 's'}`}
              className={cn(
                'flex min-h-[88px] flex-col gap-1 border-r border-b border-border p-1.5 text-left transition-colors duration-150 last:border-r-0 hover:bg-surface-2/40 focus-visible:bg-surface-2/60 focus-visible:outline-none [&:nth-child(7n)]:border-r-0',
                !inMonth && 'bg-canvas/40',
              )}
            >
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center justify-self-start rounded-full text-[12px] font-medium tabular-nums',
                  isToday
                    ? 'bg-accent text-accent-contrast'
                    : inMonth
                      ? 'text-fg'
                      : 'text-subtle',
                )}
              >
                {day.getDate()}
              </span>

              <span className="flex min-h-0 flex-col gap-0.5">
                {items.slice(0, MAX_PILLS).map((item) => (
                  <EventPill
                    key={item.id}
                    item={item}
                    course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
                  />
                ))}
                {extra > 0 && (
                  <span className="px-1 text-[11px] font-medium text-subtle">+{extra} more</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
