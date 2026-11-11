import { useState } from 'react'
import { Check, ChevronDown, Link2 } from 'lucide-react'
import type { CalendarTask } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { stripMoodleTitle } from '@/lib/moodle-match'
import { splitByTime } from './moodle-groups'
import { formatDueDateTime } from '@/lib/date'
import { cn } from '@/lib/cn'

export function MoodleRow({ task, pairedWith }: { task: CalendarTask; pairedWith?: string }) {
  const { toggleTask } = useAppData()
  const title = stripMoodleTitle(task.title) || task.title
  return (
    <li className="flex items-start gap-2.5 px-3.5 py-2">
      <button
        type="button"
        onClick={() => toggleTask(task.id)}
        aria-label={task.done ? `Mark ${title} not done` : `Mark ${title} done`}
        aria-pressed={task.done}
        className={cn(
          'mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-full border transition-colors duration-150',
          task.done ? 'border-accent bg-accent text-accent-contrast' : 'border-border-strong hover:border-accent',
        )}
      >
        {task.done && <Check size={11} strokeWidth={3} aria-hidden />}
      </button>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[13px]', task.done ? 'text-subtle line-through' : 'text-fg')}>{title}</span>
        <span className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-subtle">
          <span>{formatDueDateTime(task.due)}</span>
          {pairedWith && (
            <span className="inline-flex items-center gap-1" title="Moodle and your course list both have this one">
              <Link2 size={11} aria-hidden /> Same as {pairedWith}
            </span>
          )}
          {task.movedFrom && <span className="text-warning">Moved by Moodle</span>}
        </span>
      </span>
    </li>
  )
}

/** A list with the past items folded away under a "N earlier" toggle. */
export function MoodleList({
  items,
  pairedWith,
  now,
  pastOpenDefault = false,
}: {
  items: CalendarTask[]
  pairedWith: Map<string, string>
  now: number
  pastOpenDefault?: boolean
}) {
  const [showPast, setShowPast] = useState(pastOpenDefault)
  const { upcoming, past } = splitByTime(items, now)
  return (
    <div>
      {upcoming.length === 0 ? (
        <p className="px-3.5 py-2.5 text-[12.5px] text-subtle">Nothing coming up on Moodle.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {upcoming.map((t) => (
            <MoodleRow key={t.id} task={t} pairedWith={pairedWith.get(t.id)} />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="flex w-full items-center gap-1.5 border-t border-border/60 px-3.5 py-2 text-left text-[12px] font-medium text-muted hover:text-fg"
          >
            <ChevronDown size={13} className={cn('transition-transform duration-200', showPast && 'rotate-180')} aria-hidden />
            {past.length} earlier
          </button>
          {showPast && (
            <ul className="divide-y divide-border/60 bg-surface-2/40">
              {past.map((t) => (
                <MoodleRow key={t.id} task={t} pairedWith={pairedWith.get(t.id)} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
