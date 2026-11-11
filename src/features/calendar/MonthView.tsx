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

const MAX_PILLS = 4
/** Markers are 6px, so a phone cell holds twice what a label would. */
const MAX_DOTS = 6

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
    <div className="overflow-hidden rounded-3xl border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS().map((d) => (
          <div
            key={d}
            className="px-2 py-3 text-center text-[12px] font-semibold tracking-[0.08em] text-muted uppercase"
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
          const weekend = day.getDay() === 0 || day.getDay() === 6

          return (
            <button
              key={ymd(day)}
              type="button"
              onClick={() => onOpenDay(day)}
              aria-label={`${day.toDateString()}, ${items.length} item${items.length === 1 ? '' : 's'}`}
              className={cn(
                'flex min-h-[68px] flex-col gap-1.5 border-r border-b border-border/70 p-1 text-left transition-colors duration-150 last:border-r-0 hover:bg-surface-2/50 focus-visible:bg-surface-2/60 focus-visible:outline-none sm:min-h-[124px] sm:p-2 xl:min-h-[136px] [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0',
                !inMonth ? 'bg-canvas/50' : weekend && 'bg-canvas/25',
                isToday && 'bg-accent-soft shadow-[inset_0_0_0_2px_var(--ct-accent)]',
              )}
            >
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center justify-self-start rounded-full text-[13px] font-semibold tabular-nums',
                  isToday
                    ? 'bg-accent text-accent-contrast'
                    : inMonth
                      ? 'text-fg'
                      : 'text-subtle',
                )}
              >
                {day.getDate()}
              </span>

              {/* Phone: markers only. See EventPill's note — a title sliced
                  into a 46px cell is one letter and an ellipsis. More of them
                  fit this way too, so a busy day reads as busy instead of as
                  "+3 more". */}
              <span className="flex flex-wrap items-center gap-1 sm:hidden">
                {items.slice(0, MAX_DOTS).map((item) => (
                  <EventPill
                    key={item.id}
                    item={item}
                    dotOnly
                    course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
                  />
                ))}
                {items.length > MAX_DOTS && (
                  <span className="text-[11px] leading-none font-medium text-subtle">
                    +{items.length - MAX_DOTS}
                  </span>
                )}
              </span>

              <span className="hidden min-h-0 flex-col gap-1 sm:flex">
                {items.slice(0, MAX_PILLS).map((item) => (
                  <EventPill
                    key={item.id}
                    item={item}
                    course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
                  />
                ))}
                {extra > 0 && (
                  <span className="px-1.5 text-[11.5px] font-semibold text-muted">+{extra} more</span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
