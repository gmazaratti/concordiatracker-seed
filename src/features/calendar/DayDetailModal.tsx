import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { CalendarTask, Course } from '@/data/types'
import type { CalendarPrefs } from '@/app/providers/app-data'
import { TaskEditor } from './TaskEditor'
import { ModalShell } from '@/command/ModalShell'
import { dayItems, sameDay, type CalendarSource } from './calendar'
import { ItemRow } from './ItemRow'
import { useT } from '@/i18n/i18n'

const FULL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

function noonISO(day: Date): string {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0).toISOString()
}

/** Everything on one day, in a focused popup: mark items done, open an
 * assignment, or add a personal task/note pinned to this date. */
export function DayDetailModal({
  day,
  source,
  prefs,
  courseById,
  onClose,
}: {
  day: Date
  source: CalendarSource
  prefs: CalendarPrefs
  courseById: (id: string) => Course | undefined
  onClose: () => void
}) {
  const t = useT()
  const items = dayItems(day, source, prefs)
  // ONE form, opened either empty or on an item. The footer used to be a
  // title-and-date strip while everything else about a task was unreachable,
  // which is how `note` sat in the schema for months with no way to write it.
  const [editing, setEditing] = useState<'closed' | 'new' | CalendarTask>('closed')

  return (
    <ModalShell label={t('calendar.eventsOn', { date: FULL.format(day) })} onClose={onClose}>
      <div className="border-b border-border px-5 py-4">
        <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
          {sameDay(day, new Date()) ? t('calendar.today') : t('calendar.day')}
        </p>
        <h2 className="mt-0.5 font-display text-[20px] leading-tight font-medium text-fg">
          {FULL.format(day)}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">
          {t('calendar.nothingScheduled')}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
              closeBeforeOpen={onClose}
              onEditTask={setEditing}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border bg-surface-2/30 px-5 py-4">
        {editing === 'closed' ? (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border-strong px-3 py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
          >
            <Plus size={15} aria-hidden />
            {t('calendar.addTask')}
          </button>
        ) : (
          <TaskEditor
            key={editing === 'new' ? 'new' : editing.id}
            task={editing === 'new' ? undefined : editing}
            defaultDue={noonISO(day)}
            onDone={() => setEditing('closed')}
          />
        )}
      </div>
    </ModalShell>
  )
}
