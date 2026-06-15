import { useState } from 'react'
import { Check, X } from 'lucide-react'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { useAppData } from '@/app/providers/app-data'
import { EDITOR_STATUSES, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { gradeToInput, gradeToPercent, parseGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'

function dueTone(due: string): string {
  const days = daysUntil(due)
  if (days < 0) return 'text-danger'
  if (days === 0) return 'text-warning'
  return 'text-subtle'
}

/** One row of the course grade editor. In the Grades tab, status and grade are
 * STAGED locally and committed together on the confirm button — nothing writes
 * to the store until you save. The grade field is smart: "15/20" resolves to
 * 75% live as you type. The Notes tab is a free-form note (writes live). Every
 * row carries its date's provenance, first-class. A fixed-width kind column
 * keeps every title aligned regardless of the kind label's length. */
export function AssessmentRow({
  assessment,
  tab,
}: {
  assessment: Assessment
  tab: 'grades' | 'notes'
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
  const statusMeta = STATUS_META[draftStatus]

  function commit() {
    if (statusDirty) setStatus(assessment.id, draftStatus)
    if (gradeDirty) setGrade(assessment.id, parsedDraft)
  }

  function revert() {
    setDraftStatus(assessment.status)
    setDraftGrade(committedGradeText)
  }

  return (
    <div className={cn('px-3.5 py-3 transition-colors duration-150', dirty && 'bg-accent-soft/40')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2.5">
        <div className="flex min-w-0 flex-1 basis-[240px] items-start gap-3">
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
              <span className={cn('font-medium', dueTone(assessment.due))}>
                {relativeDueLabel(assessment.due)}
              </span>
              <ProvenanceBadge provenance={assessment.provenance} />
            </div>
          </div>
        </div>

        {tab === 'grades' ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`status-${assessment.id}`}>
              Status for {assessment.title}
            </label>
            <div className="relative">
              <span
                className={cn(
                  'pointer-events-none absolute top-1/2 left-2.5 size-1.5 -translate-y-1/2 rounded-full',
                  statusMeta.dot,
                )}
                aria-hidden
              />
              <select
                id={`status-${assessment.id}`}
                value={draftStatus}
                onChange={(e) => setDraftStatus(e.target.value as AssessmentStatus)}
                className="appearance-none rounded-md border border-border-strong bg-surface-2 py-1 pr-6 pl-6 text-[12px] font-medium text-fg focus-visible:outline-none"
              >
                {EDITOR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_META[s].label}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              inputMode="decimal"
              value={draftGrade}
              placeholder="15/20 or 82"
              aria-label={`Grade for ${assessment.title}`}
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
