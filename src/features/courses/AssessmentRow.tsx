import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { Select } from '@/components/ui/Select'
import { DropdownMenu, type MenuItem } from '@/components/ui/DropdownMenu'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { dueLabel, EDITOR_STATUSES, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { gradeToInput, gradeToPercent, parseGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'

/** One compact row of the course grade editor. Status + grade are STAGED and
 * committed together on the ✓ (nothing writes until you confirm); the grade
 * field is smart (15/20 → 75%). A per-row "⋯" (on hover) opens Edit / Delete.
 * Every control shares one height so the row reads uniform. The Notes tab swaps
 * the editor for a free-form note. */
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
  const { setStatus, setGrade, setNotes, removeAssessment, addAssessments } = useAppData()
  const { openAssessment, flashUndo } = useQuickActions()
  const [draftStatus, setDraftStatus] = useState<AssessmentStatus>(assessment.status)
  const [draftGrade, setDraftGrade] = useState(() => gradeToInput(assessment.grade))

  const committedGradeText = gradeToInput(assessment.grade)
  const parsedDraft = parseGradeInput(draftGrade)
  const gradeDirty = gradeToInput(parsedDraft) !== committedGradeText
  const statusDirty = draftStatus !== assessment.status
  const dirty = gradeDirty || statusDirty

  const draftPct = gradeToPercent(parsedDraft)
  const resolved = draftPct === null ? null : percentToGrade(draftPct)
  const due = dueLabel(assessment.due, assessment.status)

  function commit() {
    if (statusDirty) setStatus(assessment.id, draftStatus)
    if (gradeDirty) setGrade(assessment.id, parsedDraft)
  }
  function revert() {
    setDraftStatus(assessment.status)
    setDraftGrade(committedGradeText)
  }

  // One-tap done, in sync with the staged dropdown so they never disagree.
  const isDone = assessment.status === 'done'
  function toggleDone() {
    const next: AssessmentStatus = isDone ? 'not-started' : 'done'
    setStatus(assessment.id, next)
    setDraftStatus(next)
  }

  const menuItems: MenuItem[] = [
    { id: 'edit', label: 'Edit', icon: Pencil, onSelect: () => openAssessment(assessment.id) },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      danger: true,
      separated: true,
      onSelect: () => {
        removeAssessment(assessment.id)
        flashUndo(`Deleted ${assessment.title}`, () => addAssessments([assessment]))
      },
    },
  ]

  return (
    <div
      id={`assess-${assessment.id}`}
      className={cn(
        'group px-3 py-2 transition-colors duration-150',
        dirty && 'bg-accent-soft/40',
        highlighted && 'ct-highlight',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-[220px] items-center gap-2.5">
          <button
            type="button"
            onClick={toggleDone}
            title={isDone ? 'Mark not done' : 'Mark done'}
            aria-label={isDone ? `Mark "${assessment.title}" not done` : `Mark "${assessment.title}" done`}
            className={cn(
              'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150 active:scale-90',
              isDone
                ? 'border-transparent bg-success text-accent-contrast'
                : 'border-border-strong text-transparent hover:border-accent hover:bg-accent-soft hover:text-accent',
            )}
          >
            <Check size={12} strokeWidth={3} aria-hidden />
          </button>
          <span className="w-[58px] shrink-0 truncate rounded bg-surface-2 px-1.5 py-0.5 text-center text-[10px] font-medium text-muted">
            {KIND_LABEL[assessment.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-x-1.5">
              <span className="truncate text-[13px] text-fg">{assessment.title}</span>
              <span className="shrink-0 text-[11px] text-subtle">{assessment.weight}%</span>
            </div>
            <div className="mt-0.5 flex items-center gap-x-2 text-[11px]">
              <span className={cn('font-medium', due.tone)}>{due.label}</span>
              <ProvenanceBadge provenance={assessment.provenance} tone="quiet" />
            </div>
          </div>
        </div>

        {tab === 'grades' ? (
          <div className="flex items-center gap-1.5">
            <Select
              ariaLabel={`Status for ${assessment.title}`}
              value={draftStatus}
              onChange={(v) => setDraftStatus(v as AssessmentStatus)}
              size="sm"
              tone="control"
              className="h-7 w-[124px]"
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
              placeholder="%"
              title="Enter a percent (e.g. 82). Got a score like 15/20? Type it and we'll convert it."
              aria-label={`Grade for ${assessment.title} (percent, or a score like 15/20)`}
              onChange={(e) => setDraftGrade(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) commit()
                if (e.key === 'Escape' && dirty) revert()
              }}
              className="h-7 w-[72px] rounded-md border border-border-strong bg-surface-2 px-2 text-center text-[13px] font-medium text-fg tabular-nums focus-visible:outline-none"
            />

            <span className="w-10 shrink-0 text-right text-[12px] leading-tight font-medium tabular-nums">
              {resolved ? (
                <>
                  <span className="block text-fg">{Math.round(draftPct!)}%</span>
                  <span className="block text-[10px] text-subtle">{resolved.letter}</span>
                </>
              ) : (
                <span className="text-subtle">—</span>
              )}
            </span>

            <div className="flex w-[52px] shrink-0 items-center justify-end gap-1">
              {dirty ? (
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
              ) : (
                <DropdownMenu
                  ariaLabel={`Actions for "${assessment.title}"`}
                  items={menuItems}
                  triggerClassName={cn(
                    'grid size-7 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg',
                    'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-60',
                    'data-[state=open]:bg-surface-2 data-[state=open]:text-fg data-[state=open]:opacity-100',
                  )}
                />
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
            <span className={cn('size-1.5 rounded-full', STATUS_META[assessment.status].dot)} aria-hidden />
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
