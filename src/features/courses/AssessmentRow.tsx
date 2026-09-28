import { askForGrade } from '@/lib/grade-prompt'
import { haptic } from '@/lib/haptics'
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
import { gradeToPercent, readGradeInput } from '@/lib/grade'
import { draftPatch, draftView, EMPTY_DRAFT, type AssessmentDraft } from '@/lib/assessment-draft'
import { percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'

/** One compact row of the course grade editor. The status saves when picked;
 * the grade is STAGED and written on the ✓ (typing is not a decision); the grade
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
  // Only what the student has TYPED lives here; the status saves the moment it
  // is picked. See lib/assessment-draft for why an untouched field must read
  // through to the store instead of a copy taken on mount.
  const [draft, setDraft] = useState<AssessmentDraft>(EMPTY_DRAFT)
  const draftGrade = draftView(assessment, draft).gradeText

  const read = readGradeInput(draftGrade)
  const parsedDraft = read.kind === 'grade' ? read.grade : null
  // Unreadable text is a change nobody can save — it must never fall through to
  // "no grade" and wipe the real one.
  const gradeError = read.kind === 'invalid' ? read.error : null
  const planned = draftPatch(assessment, draft)
  const dirty = gradeError !== null || (planned.kind === 'patch' && 'grade' in planned.patch)

  const draftPct = gradeToPercent(parsedDraft)
  const resolved = draftPct === null ? null : percentToGrade(draftPct)
  const due = dueLabel(assessment.due, assessment.status)

  function commit() {
    if (planned.kind !== 'patch') return
    if ('grade' in planned.patch) setGrade(assessment.id, planned.patch.grade ?? null)
    setDraft(EMPTY_DRAFT)
  }
  function revert() {
    setDraft(EMPTY_DRAFT)
  }

  // A status is one decision, so it saves when it is made — from the round
  // check or the dropdown alike — and "what did you get?" follows at once in
  // both. It used to wait for Save on the dropdown path only.
  function changeStatus(next: AssessmentStatus) {
    if (next === assessment.status) return
    setStatus(assessment.id, next)
    if (next === 'done') haptic('success')
    if (next === 'done' && !assessment.grade) askForGrade(assessment.id)
  }
  const isDone = assessment.status === 'done'
  function toggleDone() {
    changeStatus(isDone ? 'not-started' : 'done')
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
          {/* Wide enough for the longest label in either language rather than
              58px and an ellipsis: "Assignment" read as "Assign…" and
              "Examen final" as "Exame…", which is a worse trade than a few
              pixels of alignment. It still has a floor, so the titles beside it
              stay in a column. */}
          <span className="min-w-[74px] shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-center text-[11px] font-medium whitespace-nowrap text-muted">
            {KIND_LABEL[assessment.kind]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-x-1.5">
              <span className="truncate text-[13px] text-fg">{assessment.title || <span className="text-subtle italic">Untitled</span>}</span>
              <span className="shrink-0 text-[11px] text-subtle">{assessment.weight}%</span>
            </div>
            <div className="mt-0.5 flex items-center gap-x-2 text-[11px]">
              <span className={cn('font-medium', due.tone)}>{due.label}</span>
              {/* Phone only, and only when there is something to say. The
                  status dropdown lives in the sheet down here, so without
                  this a marked-late item would look untouched — but printing
                  "Not started" on every row is the noise we just removed. */}
              {assessment.status !== 'not-started' && (
                <span className="inline-flex items-center gap-1 md:hidden">
                  <span
                    className={cn('size-1.5 rounded-full', STATUS_META[assessment.status].dot)}
                    aria-hidden
                  />
                  <span className={STATUS_META[assessment.status].text}>
                    {STATUS_META[assessment.status].label}
                  </span>
                </span>
              )}
              <ProvenanceBadge provenance={assessment.provenance} tone="quiet" onlyOfficial />
            </div>
          </div>
        </div>

        {tab === 'grades' ? (
          <>
            {/*
              PHONE: the basics, and a door to everything else.
              Five controls per row — status, grade, resolved mark, save,
              discard — is a desk layout on a 343px card, and it was wrapping
              into a second line per assessment, so fourteen items became a
              wall. Here a row is what it is and what it is worth; changing
              any of it opens the sheet, which has room to label its fields.
            */}
            <div className="flex items-center gap-0.5 md:hidden">
              {resolved && (
                <span className="px-1 text-right text-[12.5px] leading-tight font-medium text-fg tabular-nums">
                  {Math.round(draftPct!)}%
                </span>
              )}
              <button
                type="button"
                onClick={() => openAssessment(assessment.id)}
                aria-label={`Edit ${assessment.title}`}
                className="grid size-8 place-items-center rounded-md text-subtle transition-colors duration-150 active:bg-surface-2 active:text-fg"
              >
                <Pencil size={15} aria-hidden />
              </button>
              <DropdownMenu
                ariaLabel={`Actions for "${assessment.title}"`}
                items={menuItems}
                triggerClassName="grid size-8 place-items-center rounded-md text-subtle transition-colors duration-150 data-[state=open]:bg-surface-2 data-[state=open]:text-fg"
              />
            </div>

            <div className="hidden items-center gap-1.5 md:flex">
            <Select
              ariaLabel={`Status for ${assessment.title}`}
              value={assessment.status}
              onChange={(v) => changeStatus(v as AssessmentStatus)}
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
              aria-invalid={gradeError !== null}
              aria-describedby={gradeError ? `grade-err-${assessment.id}` : undefined}
              onChange={(e) => setDraft((d) => ({ ...d, gradeText: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) commit()
                if (e.key === 'Escape' && dirty) revert()
              }}
              className={cn(
                'h-7 w-[72px] rounded-md border bg-surface-2 px-2 text-center text-[13px] font-medium text-fg tabular-nums focus-visible:outline-none',
                gradeError ? 'border-danger' : 'border-border-strong',
              )}
            />

            <span className="w-10 shrink-0 text-right text-[12px] leading-tight font-medium tabular-nums">
              {resolved ? (
                <>
                  <span className="block text-fg">{Math.round(draftPct!)}%</span>
                  <span className="block text-[11px] text-subtle">{resolved.letter}</span>
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
                    disabled={gradeError !== null}
                    title={gradeError ?? 'Save changes'}
                    aria-label="Save changes"
                    className="grid size-7 place-items-center rounded-md bg-accent text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
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
                    'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                    'data-[state=open]:bg-surface-2 data-[state=open]:text-fg data-[state=open]:opacity-100',
                  )}
                />
              )}
            </div>
            </div>
          </>
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

      {tab === 'grades' && gradeError && (
        <p
          id={`grade-err-${assessment.id}`}
          role="alert"
          className="mt-1 hidden text-right text-[11.5px] text-danger md:block"
        >
          {gradeError}
        </p>
      )}

      {tab === 'notes' && (
        <textarea
          value={assessment.notes}
          onChange={(e) => setNotes(assessment.id, e.target.value)}
          placeholder="Add a note: what to review, where you lost marks, prof's feedback…"
          rows={2}
          className="mt-2 w-full resize-y rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus-visible:border-border-strong focus-visible:outline-none"
        />
      )}
    </div>
  )
}
