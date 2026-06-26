import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { Select } from '@/components/ui/Select'
import { useAppData } from '@/app/providers/app-data'
import { dueLabel, EDITOR_STATUSES, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { gradeToInput, gradeToPercent, parseGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'

/** One row of the course grade editor. In the Grades tab, status and grade are
 * STAGED locally and committed together on the confirm button — nothing writes
 * to the store until you save. The grade field is smart: "15/20" resolves to
 * 75% live as you type. The Notes tab is a free-form note (writes live). Every
 * row carries its date's provenance, first-class. A fixed-width kind column
 * keeps every title aligned regardless of the kind label's length. */
export function AssessmentRow({
  assessment,
  tab,
  highlighted = false,
}: {
  assessment: Assessment
  tab: 'grades' | 'notes'
  /** Briefly glow this row (e.g. after "Open in course" scrolls to it). */
  highlighted?: boolean
}) {
  const { setStatus, setGrade, setNotes } = useAppData()
  const [draftStatus, setDraftStatus] = useState<AssessmentStatus>(assessment.status)
  const [draftGrade, setDraftGrade] = useState(() => gradeToInput(assessment.grade))

  const committedGradeText = gradeToInput(assessment.grade)
  const parsedDraft = parseGradeInput(draftGrade)
  const gradeDirty = gradeToInput(parsedDraft) !== committedGradeText
  const statusDirty = draftStatus !== assessment.status
  const dirty = gradeDirty || statusDirty

  const draftPct = gradeToPercent(parsedDraft)
  const resolved = draftPct === null ? null : percentToGrade(draftPct)
  // Status-aware: a done item past its date reads "Done late", never overdue.
  const due = dueLabel(assessment.due, assessment.status)

  function commit() {
    if (statusDirty) setStatus(assessment.id, draftStatus)
    if (gradeDirty) setGrade(assessment.id, parsedDraft)
  }

  function revert() {
    setDraftStatus(assessment.status)
    setDraftGrade(committedGradeText)
  }

  // One-tap done, separate from the staged status dropdown. Commits immediately
  // and keeps the dropdown in sync so the two never disagree.
  const isDone = assessment.status === 'done'
  function toggleDone() {
    const next: AssessmentStatus = isDone ? 'not-started' : 'done'
    setStatus(assessment.id, next)
    setDraftStatus(next)
  }

  return (
    <div
      id={`assess-${assessment.id}`}
      className={cn(
        'px-3.5 py-3 transition-colors duration-150',
        dirty && 'bg-accent-soft/40',
        highlighted && 'ct-highlight',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
        <div className="flex min-w-0 flex-1 basis-[240px] items-start gap-3">
          <button
            type="button"
            onClick={toggleDone}
            title={isDone ? 'Mark not done' : 'Mark done'}
            aria-label={isDone ? `Mark "${assessment.title}" not done` : `Mark "${assessment.title}" done`}
            className={cn(
              'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150 active:scale-90',
              isDone
                ? 'border-transparent bg-success text-accent-contrast'
                : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
            )}
          >
            <Check size={12} strokeWidth={3} aria-hidden />
          </button>
          <div className="w-[76px] shrink-0 pt-0.5">
            <span className="inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
              {KIND_LABEL[assessment.kind]}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[14px] text-fg">{assessment.title}</span>
              <span className="text-[12px] text-subtle">· {assessment.weight}%</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
              <span className={cn('font-medium', due.tone)}>{due.label}</span>
              <ProvenanceBadge provenance={assessment.provenance} />
            </div>
          </div>
        </div>

        {tab === 'grades' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select
              ariaLabel={`Status for ${assessment.title}`}
              value={draftStatus}
              onChange={(v) => setDraftStatus(v as AssessmentStatus)}
              size="sm"
              tone="control"
              className="w-[148px]"
              options={EDITOR_STATUSES.map((s) => ({
                value: s,
                label: STATUS_META[s].label,
                dot: STATUS_META[s].dot,
              }))}
            />

            <input
              type="text"
              inputMode="decimal"
              value={draftGrade}
              placeholder="82%"
              title="Enter a percent (e.g. 82). Got a score like 15/20? Type it and we'll convert it."
              aria-label={`Grade for ${assessment.title} (percent, or a score like 15/20)`}
              onChange={(e) => setDraftGrade(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) commit()
                if (e.key === 'Escape' && dirty) revert()
              }}
              className="w-[104px] rounded-md border border-border-strong bg-surface-2 px-2 py-1 text-center text-[13px] font-medium text-fg tabular-nums focus-visible:outline-none"
            />

            <span className="w-12 shrink-0 text-right text-[12px] leading-tight font-medium tabular-nums">
              {resolved ? (
                <>
                  <span className="block text-fg">{Math.round(draftPct!)}%</span>
                  <span className="block text-[10px] text-subtle">
                    {resolved.letter} · {resolved.points.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </span>

            <div className="flex w-[58px] shrink-0 items-center justify-end gap-1">
              {dirty && (
                <>
                  <button
                    type="button"
                    onClick={revert}
                    title="Discard changes"
                    aria-label="Discard changes"
                    className="grid size-7 place-items-center rounded-md border border-border-strong text-subtle transition-colors duration-150 hover:text-fg"
                  >
                    <X size={14} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={commit}
                    title="Save changes"
                    aria-label="Save changes"
                    className="grid size-7 place-items-center rounded-md bg-accent text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover"
                  >
                    <Check size={15} aria-hidden />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-[11px] font-medium',
              STATUS_META[assessment.status].text,
            )}
          >
            <span
              className={cn('size-1.5 rounded-full', STATUS_META[assessment.status].dot)}
              aria-hidden
            />
            {STATUS_META[assessment.status].label}
          </span>
        )}
      </div>

      {tab === 'notes' && (
        <textarea
          value={assessment.notes}
          onChange={(e) => setNotes(assessment.id, e.target.value)}
          placeholder="Add a note — what to review, where you lost marks, prof's feedback…"
          rows={2}
          className="mt-2 w-full resize-y rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus-visible:border-border-strong focus-visible:outline-none"
        />
      )}
    </div>
  )
}
