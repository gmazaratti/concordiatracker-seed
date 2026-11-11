import { useState } from 'react'
import { ArrowRight, CalendarCheck2 } from 'lucide-react'
import type { CalendarPrefs } from '@/app/providers/app-data'
import type { Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { formatMonthDay, relativeDueLabel } from '@/lib/date'
import { isFinished } from '@/lib/status'
import { agendaDays, type CalendarItem, type CalendarSource } from './calendar'

/**
 * What is coming, in order: the next few things of YOURS that are still open
 * (assignments and tasks, not the university's dates). A month grid answers
 * "what is on the 17th"; this answers "what do I do next" without reading 42
 * squares. Tapping a row opens that day.
 */
export function UpNext({
  source,
  prefs,
  courseById,
  onOpenDay,
}: {
  source: CalendarSource
  prefs: CalendarPrefs
  courseById: (id: string) => Course | undefined
  onOpenDay: (day: Date) => void
}) {
  // One clock read for the life of the panel, so render stays pure.
  const [today] = useState(() => new Date())
  const rows: { day: Date; item: CalendarItem }[] = []
  for (const { day, items } of agendaDays(today, 60, source, prefs)) {
    for (const item of items) {
      if (item.kind === 'assessment' && !isFinished(item.assessment.status)) rows.push({ day, item })
      else if (item.kind === 'task' && !item.task.done) rows.push({ day, item })
      if (rows.length === 5) break
    }
    if (rows.length === 5) break
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-surface">
      <p className="flex items-center gap-2 px-4 pt-4 pb-2 font-display text-[16px] font-semibold text-fg">
        <CalendarCheck2 size={17} className="text-accent" aria-hidden />
        Up next
      </p>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-[13px] leading-relaxed text-muted">Nothing of yours is due in the next two months.</p>
      ) : (
        <ul className="pb-2">
          {rows.map(({ day, item }) => {
            const course = item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined
            const hex = course ? courseColor(course.color).hex : undefined
            const title = item.kind === 'assessment' ? item.assessment.title : item.kind === 'task' ? item.task.title : ''
            const due = item.kind === 'assessment' ? item.assessment.due : item.kind === 'task' ? item.task.due : null
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2/50"
                >
                  <span className="flex w-10 shrink-0 flex-col items-center rounded-xl bg-canvas/70 py-1 text-center">
                    <span className="text-[9.5px] font-bold tracking-[0.1em] text-subtle uppercase">
                      {formatMonthDay(day).split(' ')[0]}
                    </span>
                    <span className="font-display text-[16px] leading-none font-bold text-fg tabular-nums">{day.getDate()}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-fg">{title}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted">
                      <span className="size-2 shrink-0 rounded-full bg-subtle" style={hex ? { backgroundColor: hex } : undefined} aria-hidden />
                      <span className="truncate">
                        {course?.code ?? 'Task'} · {relativeDueLabel(due)}
                      </span>
                    </span>
                  </span>
                  <ArrowRight size={14} className="shrink-0 text-subtle transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
