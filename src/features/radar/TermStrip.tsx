import { useState } from 'react'
import { useAppData } from '@/app/providers/app-data'
import { courseColor } from '@/lib/course-color'
import { formatMonthDay } from '@/lib/date'
import { parseDay } from '@/features/calendar/calendar'
import { cn } from '@/lib/cn'
import type { WeekLoad } from './rules'

/**
 * The term as a shape.
 *
 * One column a week, height by how much of your grade lands in it. It exists
 * because the calendar answers "when is this due" and cannot answer "when does
 * this term get hard" — the second question needs everything summed across
 * courses, and it is the one people get wrong. A student looking at four
 * separate course pages sees four reasonable schedules; the same four courses
 * on one axis show the fortnight in November that decides the semester.
 *
 * Deliberately not a chart library. It is fifteen divs.
 */
const HEAVY = 40
const BUSY = 20

export function TermStrip({ weeks }: { weeks: WeekLoad[] }) {
  const { courses } = useAppData()
  const [open, setOpen] = useState<string | null>(null)
  const peak = Math.max(HEAVY, ...weeks.map((w) => w.weight))
  const colourOf = new Map(courses.map((c) => [c.id, courseColor(c.color).hex]))
  const active = weeks.find((w) => w.start === open)

  return (
    <div>
      <div className="flex items-end gap-1 sm:gap-1.5" role="list" aria-label="Weekly load">
        {weeks.map((week, i) => {
          const height = Math.max(2, Math.round((week.weight / peak) * 100))
          const tone =
            week.weight >= HEAVY ? 'bg-danger' : week.weight >= BUSY ? 'bg-warning' : 'bg-accent'
          const isOpen = open === week.start
          return (
            <button
              key={week.start}
              type="button"
              role="listitem"
              onClick={() => setOpen(isOpen ? null : week.start)}
              aria-label={`Week of ${week.start}: ${Math.round(week.weight)} percent`}
              aria-expanded={isOpen}
              className="group relative flex min-w-0 flex-1 flex-col items-center pb-5"
            >
              <span className="flex h-36 w-full items-end justify-center sm:h-44">
                <span
                  className={cn(
                    'w-full rounded-t-md transition-all duration-200',
                    week.weight === 0 ? 'bg-border/60' : tone,
                    isOpen ? 'opacity-100' : 'opacity-80 group-hover:opacity-100',
                  )}
                  style={{ height: `${week.weight === 0 ? 2 : height}%` }}
                />
              </span>
              {/* Every fourth label, so the axis stays readable on a phone
                  without dropping the bars themselves. */}
              <span
                className={cn(
                  'absolute bottom-0 left-1/2 -translate-x-1/2 text-[9.5px] whitespace-nowrap tabular-nums sm:text-[11px]',
                  isOpen ? 'text-fg' : 'text-subtle',
                  i % 4 === 0 || isOpen ? 'opacity-100' : 'opacity-0',
                )}
              >
                {formatMonthDay(parseDay(week.start))}
              </span>
            </button>
          )
        })}
      </div>

      {/* Detail sits below rather than in a tooltip: this is a thing you read,
          not a thing you glance at, and a tooltip is unusable on a phone. */}
      <div className="mt-3 min-h-[60px] rounded-2xl bg-canvas/70 px-4 py-3">
        {active ? (
          active.items.length === 0 ? (
            <p className="text-[13px] text-muted">
              Week of {formatMonthDay(parseDay(active.start))}: nothing due. Those exist too.
            </p>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-fg">
                Week of {formatMonthDay(parseDay(active.start))} ·{' '}
                <span className={active.weight >= HEAVY ? 'text-danger' : 'text-muted'}>
                  {Math.round(active.weight)}% of your grade
                </span>
              </p>
              <ul className="mt-1.5 space-y-1">
                {active.items.map((a) => {
                  const course = courses.find((c) => c.id === a.courseId)
                  return (
                    <li key={a.id} className="flex items-center gap-2 text-[13px] text-muted">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: colourOf.get(a.courseId) ?? '#888' }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate">
                        <span className="text-fg">{course?.code ?? ''}</span> {a.title}
                      </span>
                      <span className="shrink-0 tabular-nums">{a.weight}%</span>
                    </li>
                  )
                })}
              </ul>
            </>
          )
        ) : (
          <p className="text-[13px] text-muted">
            Tap a bar to see what is due that week. Red is a heavy week, amber a busy one.
          </p>
        )}
      </div>
    </div>
  )
}
