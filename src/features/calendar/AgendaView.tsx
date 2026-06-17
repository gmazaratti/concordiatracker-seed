import { CalendarRange } from 'lucide-react'
import type { Course } from '@/data/types'
import type { CalendarPrefs } from '@/app/providers/app-data'
import { Card } from '@/components/ui/Card'
import { startOfToday } from '@/lib/date'
import { agendaDays, sameDay, type CalendarSource } from './calendar'
import { ItemRow } from './ItemRow'

const HEADER = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
const AGENDA_WINDOW = 60

/** The agenda — a flat, scannable list of upcoming days that have something on
 * them. The phone-first default: everything in one calm column. */
export function AgendaView({
  source,
  prefs,
  courseById,
}: {
  source: CalendarSource
  prefs: CalendarPrefs
  courseById: (id: string) => Course | undefined
}) {
  const from = startOfToday()
  const today = new Date()
  const groups = agendaDays(from, AGENDA_WINDOW, source, prefs)

  if (groups.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <CalendarRange size={26} aria-hidden />
        </span>
        <h3 className="font-display text-xl font-medium text-fg">Nothing ahead</h3>
        <p className="max-w-xs text-sm text-muted">
          No deadlines, tasks, or university dates in the next two months
          {prefs.showConcordia && prefs.showMine ? '' : ' on the active layers'}.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(({ day, items }) => (
        <section key={day.toDateString()}>
          <h3 className="mb-1.5 flex items-baseline gap-2 px-1">
            <span className="text-[13px] font-semibold text-fg">
              {sameDay(day, today) ? 'Today' : HEADER.format(day)}
            </span>
            {sameDay(day, today) && (
              <span className="text-[12px] text-subtle">{HEADER.format(day)}</span>
            )}
          </h3>
          <Card className="divide-y divide-border overflow-hidden">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
              />
            ))}
          </Card>
        </section>
      ))}
    </div>
  )
}
