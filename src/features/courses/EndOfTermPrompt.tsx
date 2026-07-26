import { useMemo, useState } from 'react'
import { Archive, GraduationCap, Loader2 } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { term } from '@/data/mock'
import { coursePercent, percentToGrade } from '@/lib/gpa'
import { ModalShell } from '@/command/ModalShell'
import { Button } from '@/components/ui/Button'

/** Days after the term's end date before we offer to wrap it up. */
const GRACE_DAYS = 3

/** Evaluated ONCE at module load — the term end is fixed, so this needn't be
 * reactive (and keeps the component's render pure). */
const TERM_IS_OVER = (Date.now() - new Date(term.end).getTime()) / 86_400_000 >= GRACE_DAYS

/**
 * When the term is over, offer to archive its courses — with an explicit
 * confirm, never automatically. Archiving freezes each course's grade onto the
 * transcript. Dismissible; asks once per term.
 */
export function EndOfTermPrompt() {
  const { courses, assessments, archiveCourse } = useAppData()
  const { uiState, loaded, patchUiState } = useUiState()
  const [busy, setBusy] = useState(false)

  // Courses belonging to the term that just ended.
  const finishing = useMemo(() => courses.filter((c) => c.term === term.name), [courses])

  const dismissedFor = uiState.termWrapDismissed
  const shouldAsk =
    loaded && TERM_IS_OVER && finishing.length > 0 && dismissedFor !== term.name

  if (!shouldAsk) return null

  const dismiss = () => patchUiState({ termWrapDismissed: term.name })

  const archiveAll = () => {
    setBusy(true)
    for (const c of finishing) archiveCourse(c.id)
    patchUiState({ termWrapDismissed: term.name })
  }

  return (
    <ModalShell label="Wrap up the term" onClose={dismiss}>
      <div className="p-6 sm:p-7">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
          <GraduationCap size={24} aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-[21px] leading-tight font-semibold text-fg">
          Wrap up {term.name}?
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          The term&rsquo;s over. Archiving moves these {finishing.length} course
          {finishing.length === 1 ? '' : 's'} to your transcript and{' '}
          <span className="font-medium text-fg">locks in their final grades</span>, so editing old
          assignments later can never change your GPA history.
        </p>

        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {finishing.map((c) => {
            const pct = coursePercent(assessments.filter((a) => a.courseId === c.id))
            return (
              <li key={c.id} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                  {c.code || 'Untitled'}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-subtle">
                  {pct === null ? 'no grades' : `${Math.round(pct)}%`}
                </span>
                <span className="w-9 shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-center text-[12px] font-semibold text-fg">
                  {pct === null ? '—' : percentToGrade(pct).letter}
                </span>
              </li>
            )
          })}
        </ul>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={dismiss}>Not yet</Button>
          <Button disabled={busy} onClick={archiveAll}>
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Archive size={15} aria-hidden />}
            Archive {finishing.length} course{finishing.length === 1 ? '' : 's'}
          </Button>
        </div>
        <p className="mt-2.5 text-right text-[11.5px] text-subtle">
          You can move a course back anytime from Past semesters.
        </p>
      </div>
    </ModalShell>
  )
}
