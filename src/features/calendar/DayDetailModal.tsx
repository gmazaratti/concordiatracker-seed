import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { Course } from '@/data/types'
import { useAppData, type CalendarPrefs } from '@/app/providers/app-data'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { ModalShell } from '@/command/ModalShell'
import { dayItems, sameDay, type CalendarSource } from './calendar'
import { ItemRow } from './ItemRow'

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
  const { addTask } = useAppData()
  const items = dayItems(day, source, prefs)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState(() => noonISO(day))

  function add() {
    const t = title.trim()
    if (!t) return
    addTask({ title: t, due })
    setTitle('')
  }

  return (
    <ModalShell label={`Events on ${FULL.format(day)}`} onClose={onClose}>
      <div className="border-b border-border px-5 py-4">
        <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
          {sameDay(day, new Date()) ? 'Today' : 'Day'}
        </p>
        <h2 className="mt-0.5 font-display text-[20px] leading-tight font-medium text-fg">
          {FULL.format(day)}
        </h2>
      </div>

      {items.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-muted">
          Nothing scheduled. Add a task below.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              course={item.kind === 'assessment' ? courseById(item.assessment.courseId) : undefined}
              closeBeforeOpen={onClose}
            />
          ))}
        </div>
      )}

      <div className="border-t border-border bg-surface-2/30 px-5 py-4">
        <label className="mb-1.5 block text-[11px] font-medium tracking-wide text-subtle uppercase">
          Add a task
        </label>
        <input
          type="text"
          value={title}
          placeholder="e.g. Review lecture notes"
          aria-label="Task title"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add()
          }}
          className="w-full rounded-lg border border-border-strong bg-surface px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus-visible:outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <DateTimePicker value={due} onChange={setDue} ariaLabel="Task date and time" />
          </div>
          <button
            type="button"
            onClick={add}
            disabled={!title.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={15} aria-hidden />
            Add
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
