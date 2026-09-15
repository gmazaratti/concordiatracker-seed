import { useState } from 'react'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { formatDueDateTime } from '@/lib/date'
import type { MoodleMismatch as Mismatch } from '@/lib/moodle-match'

/**
 * "Moodle says this moved."
 *
 * The item Moodle synced and the assessment on your course are two records of
 * the same coursework, and only one of them carries the weight your grade is
 * computed from. When the professor moves a date in Moodle, the synced item
 * follows and the assessment does not — so the one that matters to your GPA is
 * the one left stale. This is where that gets said.
 *
 * SUGGESTED, NEVER AUTOMATIC, and for a different reason than the calendar
 * note. There the item IS the Moodle event, so the new date is simply true.
 * Here we have GUESSED that two differently-named records are the same thing.
 * The guess is deliberately conservative (see lib/moodle-match.ts) but it is
 * still a guess, so the student confirms it — and the card shows the Moodle
 * event's own title so they can check the match rather than trust it.
 *
 * Dismiss is per-session on purpose: there is nothing to persist, because the
 * underlying disagreement is recomputed from live data. Fix the date in either
 * system and the card stops appearing on its own.
 */
export function MoodleMismatchCard({ mismatch }: { mismatch: Mismatch }) {
  const { updateAssessment } = useAppData()
  const { flashUndo } = useQuickActions()
  const [gone, setGone] = useState(false)
  if (gone) return null

  function accept() {
    const before = mismatch.yourDue
    updateAssessment(mismatch.assessmentId, { due: mismatch.moodleDue })
    flashUndo(`${mismatch.title} moved to ${formatDueDateTime(mismatch.moodleDue)}`, () =>
      updateAssessment(mismatch.assessmentId, { due: before }),
    )
    setGone(true)
  }

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/5 p-3">
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-fg">
        <CalendarClock size={14} className="shrink-0 text-warning" aria-hidden />
        Moodle has a different date for {mismatch.title}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="rounded-md bg-surface-2 px-2 py-1">
          <span className="text-subtle">Yours</span>{' '}
          <span className="font-medium text-fg">{formatDueDateTime(mismatch.yourDue)}</span>
        </span>
        <ArrowRight size={13} className="shrink-0 text-subtle" aria-hidden />
        <span className="rounded-md bg-accent-soft px-2 py-1">
          <span className="text-subtle">Moodle</span>{' '}
          <span className="font-medium text-accent">{formatDueDateTime(mismatch.moodleDue)}</span>
        </span>
      </div>

      {/* The evidence, not just the conclusion. We matched two records by
          name, so the name we matched on is the thing that makes this
          checkable instead of something to be taken on faith. */}
      <p className="mt-2 text-[11.5px] leading-relaxed text-subtle">
        Matched to the Moodle event &ldquo;{mismatch.viaTitle}&rdquo;. Your weight, grade and notes
        stay exactly as they are — only the date changes.
      </p>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={accept}
          className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity hover:opacity-90"
        >
          Use Moodle&rsquo;s date
        </button>
        <button
          type="button"
          onClick={() => setGone(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          Keep mine
        </button>
      </div>
    </div>
  )
}
