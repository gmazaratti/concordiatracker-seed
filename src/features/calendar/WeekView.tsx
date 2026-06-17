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

/** The week board — seven day columns, each a scannable stack of events. Clicking
 * an assignment opens its detail popover; anything else (or the day header) opens
 * that day's detail. */
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
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <div className="grid min-w-[640px] grid-cols-7">
        {days.map((day) => {
          const items = dayItems(day, source, prefs)
          const isToday = sameDay(day, today)
          return (
            <div key={ymd(day)} className="flex min-h-[320px] flex-col border-r border-border last:border-r-0">
              <button
                type="button"
                onClick={() => onOpenDay(day)}
                className="flex items-center justify-between gap-1 border-b border-border px-2.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2/40 focus-visible:outline-none focus-visible:bg-surface-2/60"
              >
                <span className="text-[11px] font-semibold tracking-wide text-subtle uppercase">
                  {WEEKDAYS[day.getDay()]}
                </span>
                <span
                  className={cn(
                    'grid size-6 place-items-center rounded-full text-[12px] font-medium tabular-nums',
                    isToday ? 'bg-accent text-accent-contrast' : 'text-fg',
                  )}
                >
                  {day.getDate()}
                </span>
              </button>

              <div className="flex flex-1 flex-col gap-1 p-1.5">
                {items.length === 0 ? (
                  <span className="px-1 pt-1 text-[11px] text-subtle/50">—</span>
                ) : (
                  items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => activate(item, day)}
                      className="rounded-md text-left transition-colors duration-150 hover:bg-surface-2/50 focus-visible:bg-surface-2/60 focus-visible:outline-none"
                    >
                      <EventPill
                        item={item}
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
