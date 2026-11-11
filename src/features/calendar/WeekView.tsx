import type { Course } from '@/data/types'
import type { CalendarPrefs } from '@/app/providers/app-data'
import {
  WEEKDAYS,
  dayItems,
  sameDay,
  weekDays,
  ymd,
  type CalendarItem,
  type CalendarSource,
} from './calendar'
import { EventPill } from './EventPill'
import { cn } from '@/lib/cn'

/** The week board: seven day columns, each a stack of the same filled chips the
 * month uses. The day's number is the column's heading, today's column is
 * tinted, and weekends are slightly shaded. Clicking an assignment opens its
 * detail popover; anything else (or the day header) opens that day's detail. */
export function WeekView({
  view,
  source,
  prefs,
  courseById,
  onOpenDay,
  onOpenAssessment,
}: {
  view: Date
  source: CalendarSource
  prefs: CalendarPrefs
  courseById: (id: string) => Course | undefined
  onOpenDay: (day: Date) => void
  onOpenAssessment: (id: string) => void
}) {
  const days = weekDays(view)
  const today = new Date()

  function activate(item: CalendarItem, day: Date) {
    if (item.kind === 'assessment') onOpenAssessment(item.assessment.id)
    else onOpenDay(day)
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-border bg-surface">
      <div className="grid min-w-[760px] grid-cols-7">
        {days.map((day) => {
          const items = dayItems(day, source, prefs)
          const isToday = sameDay(day, today)
          const weekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <div
              key={ymd(day)}
              className={cn(
                'flex min-h-[420px] flex-col border-r border-border/70 last:border-r-0 xl:min-h-[520px]',
                isToday ? 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--ct-accent)]' : weekend && 'bg-canvas/25',
                isToday && 'first:rounded-l-3xl last:rounded-r-3xl',
              )}
            >
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                className="flex flex-col items-start gap-1 border-b border-border/70 px-3 pt-3.5 pb-3 text-left transition-colors duration-150 hover:bg-surface-2/50 focus-visible:bg-surface-2/60 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'text-[12px] font-semibold tracking-[0.08em] uppercase',
                    isToday ? 'text-accent' : 'text-muted',
                  )}
                >
                  {WEEKDAYS()[day.getDay()]}
                </span>
                <span className="flex w-full items-end justify-between gap-2">
                  <span
                    className={cn(
                      'font-display text-[30px] leading-none font-bold tabular-nums',
                      isToday ? 'text-accent' : 'text-fg',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-muted tabular-nums">
                      {items.length}
                    </span>
                  )}
                </span>
              </button>

              <div className="flex flex-1 flex-col gap-1.5 p-2">
                {items.length === 0 ? (
                  <span className="px-1 pt-2 text-[12px] text-subtle">Nothing due</span>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => activate(item, day)}
                      className="rounded-lg text-left transition-opacity duration-150 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                    >
                      <EventPill
                        item={item}
                        wrap
                        course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
                      />
                    </button>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
