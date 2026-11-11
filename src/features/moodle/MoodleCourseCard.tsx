import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDueDateTime } from '@/lib/date'
import { stripMoodleTitle } from '@/lib/moodle-match'
import { MOODLE_ORANGE, MoodleBanner, MoodleMark } from './MoodleBrand'
import { splitByTime, useMoodleGroups } from './moodle-groups'

/** Everything the two card shapes need, or null when Moodle has sent nothing. */
function useMoodleSummary() {
  const { groups, total } = useMoodleGroups()
  const [now] = useState(() => Date.now())
  if (total === 0) return null
  const all = [...groups.values()].flat()
  const { upcoming } = splitByTime(all, now)
  const open = upcoming.filter((t) => !t.done)
  const done = all.filter((t) => t.done).length
  const classes = groups.size - (groups.has('') ? 1 : 0)
  return { total, open, done, classes, next: open[0] }
}

/**
 * Moodle as a class card in the Courses grid: same shape as CourseGridCard,
 * with Moodle's banner where a class has its colour. Opens the Moodle page.
 * Absent until Moodle has sent something.
 */
export function MoodleGridCard() {
  const m = useMoodleSummary()
  if (!m) return null
  const pct = (m.done / m.total) * 100
  return (
    <Link to="/app/courses/moodle" className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-border-strong">
      <MoodleBanner className="h-[128px]" />
      <div className="flex flex-1 flex-col px-5 pt-4 pb-4">
        <div>
          <span className="font-display text-[38px] leading-none font-bold text-fg tabular-nums">{m.open.length}</span>
          <span className="ml-2 text-[14px] font-semibold text-muted">coming up</span>
        </div>
        <div className="mt-3.5 min-h-[34px]">
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full transition-[width] duration-200" style={{ width: `${pct}%`, backgroundColor: MOODLE_ORANGE }} />
          </div>
          <p className="mt-1.5 text-[12px] text-subtle">
            {m.done} of {m.total} done · {m.classes} class{m.classes === 1 ? '' : 'es'}
          </p>
        </div>
        <div className="mt-auto flex items-center justify-between gap-2.5 rounded-2xl bg-canvas/60 px-3.5 py-3 text-[13px]">
          {m.next ? (
            <>
              <span className="min-w-0 truncate text-muted">{stripMoodleTitle(m.next.title) || m.next.title}</span>
              <span className="shrink-0 text-subtle">{formatDueDateTime(m.next.due)}</span>
            </>
          ) : (
            <span className="text-subtle">Nothing coming up</span>
          )}
        </div>
      </div>
    </Link>
  )
}

/** The same thing as a row, for the Courses list view. */
export function MoodleListRow() {
  const m = useMoodleSummary()
  if (!m) return null
  return (
    <Link to="/app/courses/moodle" className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors duration-150 hover:border-border-strong">
      <MoodleMark className="size-9 shrink-0 text-[16px]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-fg">Moodle</span>
        <span className="block truncate text-[12px] text-subtle">
          {m.open.length} coming up · {m.done} of {m.total} done · {m.classes} class{m.classes === 1 ? '' : 'es'}
        </span>
      </span>
      {m.next && <span className="hidden shrink-0 text-[12px] text-muted sm:block">Next: {formatDueDateTime(m.next.due)}</span>}
    </Link>
  )
}
