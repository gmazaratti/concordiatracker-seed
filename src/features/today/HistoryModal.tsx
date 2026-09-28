import { useMemo, useState } from 'react'
import { Search, Undo2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { useAppData } from '@/app/providers/app-data'
import { isOpen } from '@/lib/status'
import { STATUS_META } from '@/lib/status'
import { formatDueDateTime } from '@/lib/date'
import { gradeToPercent } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { coveredTaskIds, pairMoodleToAssessments, stripMoodleTitle } from '@/lib/moodle-match'
import { haptic } from '@/lib/haptics'
import { useT } from '@/i18n/i18n'

/** How many finished rows to show before "Show more". */
const PAGE = 40

interface Row {
  key: string
  kind: 'assessment' | 'task'
  id: string
  title: string
  course: string
  due: string | null
  detail: string
}

/**
 * Everything already finished, newest deadline first, each one undoable.
 *
 * Today only shows what is still ahead (plus what you finished in this visit),
 * so a thing ticked by mistake yesterday had no way back short of finding it in
 * the right course. This is that way back, and it covers synced Moodle items as
 * well as assessments. Undo puts the item back on the list as not done; a grade
 * already entered stays, because undoing a tick is not the same as deleting a
 * mark.
 */
export function HistoryModal({ onClose }: { onClose: () => void }) {
  const t = useT()
  const { assessments, courses, personalTasks, setStatus, toggleTask } = useAppData()
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  const rows = useMemo<Row[]>(() => {
    const code = new Map(courses.map((c) => [c.id, c.code]))
    const out: Row[] = []
    for (const a of assessments) {
      if (isOpen(a.status)) continue
      const pct = gradeToPercent(a.grade)
      out.push({
        key: `a:${a.id}`,
        kind: 'assessment',
        id: a.id,
        title: a.title || 'Untitled',
        course: code.get(a.courseId) ?? '',
        due: a.due,
        detail: pct != null ? `${Math.round(pct)}% ${percentToGrade(pct).letter}` : STATUS_META[a.status].label,
      })
    }
    // A Moodle item that is also an assessment (paired, or graded into one from
    // the prompt) is shown once, as the assessment: that is the copy with the
    // grade, same as on Today.
    const covered = coveredTaskIds(pairMoodleToAssessments(personalTasks, assessments, courses))
    for (const task of personalTasks) {
      if (!task.done || covered.has(task.id)) continue
      out.push({
        key: `t:${task.id}`,
        kind: 'task',
        id: task.id,
        title: task.source === 'moodle' ? stripMoodleTitle(task.title) || task.title : task.title,
        course: task.source === 'moodle' ? 'Moodle' : t('today.history.task'),
        due: task.due,
        detail: STATUS_META.done.label,
      })
    }
    return out.sort((x, y) => (y.due ?? '').localeCompare(x.due ?? ''))
  }, [assessments, courses, personalTasks, t])

  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((r) => `${r.title} ${r.course}`.toLowerCase().includes(q)) : rows

  function undo(r: Row) {
    haptic('tap')
    if (r.kind === 'assessment') setStatus(r.id, 'not-started')
    else toggleTask(r.id)
  }

  return (
    <ModalShell label={t('today.history.title')} onClose={onClose} widthClass="sm:max-w-lg">
      <div className="p-5">
        <h2 className="font-display text-[18px] font-semibold text-fg">{t('today.history.title')}</h2>
        <p className="mt-1 text-[12.5px] text-muted">{t('today.history.sub')}</p>
        <label className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
          <Search size={14} className="text-subtle" aria-hidden />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder={t('today.history.search')}
            aria-label={t('today.history.search')}
            className="min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-subtle"
          />
        </label>

        {shown.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-subtle">
            {q ? t('today.history.noMatch') : t('today.history.empty')}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {shown.slice(0, limit).map((r) => (
              <li key={r.key} className="flex min-h-11 items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-fg">{r.title}</p>
                  <p className="truncate text-[12px] text-subtle">
                    {[r.course, r.due ? formatDueDateTime(r.due) : null, r.detail].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => undo(r)}
                  aria-label={t('today.history.undoLabel', { title: r.title })}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-medium text-fg hover:bg-surface-2"
                >
                  <Undo2 size={14} aria-hidden />
                  {t('today.history.undo')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {shown.length > limit && (
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE)}
            className="mt-2 min-h-11 w-full rounded-lg text-[12.5px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            {t('today.history.more', { n: shown.length - limit })}
          </button>
        )}
      </div>
    </ModalShell>
  )
}
