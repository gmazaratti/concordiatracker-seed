import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { CourseChip } from '@/components/CourseChip'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { PeerSuggestion } from '@/components/PeerSuggestion'
import { EDITOR_STATUSES, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { gradeToInput, gradeToPercent, parseGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { courseColor } from '@/lib/course-color'
import { Select } from '@/components/ui/Select'
import { DateTimePicker } from '@/components/ui/DateTimePicker'
import { ModalShell } from './ModalShell'

/** The Edit popup for one assessment (opened from the row "⋮" menu and the
 * command palette). A small card — not a full page — to edit the due date + time,
 * status (incl. "awaiting grade"), grade, and notes in one place. Saving writes a
 * single patch to the store and flashes a reversible Undo. */
export function AssessmentDetailModal({ id }: { id: string }) {
  const { assessments, courseById, updateAssessment, peerCorrections } = useAppData()
  const { closeTarget, flashUndo } = useQuickActions()
  const navigate = useNavigate()

  const assessment = assessments.find((a) => a.id === id)
  const course = assessment ? courseById(assessment.courseId) : undefined
  const correction = peerCorrections.find((c) => c.assessmentId === id)

  const [status, setStatusDraft] = useState<AssessmentStatus>(
    assessment?.status ?? 'not-started',
  )
  const [gradeText, setGradeText] = useState(() => gradeToInput(assessment?.grade ?? null))
  const [dueISO, setDueISO] = useState(assessment?.due ?? '')
  const [notes, setNotes] = useState(assessment?.notes ?? '')

  if (!assessment || !course) return null

  const parsed = parseGradeInput(gradeText)
  const pct = gradeToPercent(parsed)
  const resolved = pct === null ? null : percentToGrade(pct)
  const { hex } = courseColor(course.color)

  const statusDirty = status !== assessment.status
  const gradeDirty = gradeToInput(parsed) !== gradeToInput(assessment.grade)
  const dueDirty = !!dueISO && dueISO !== assessment.due
  const notesDirty = notes !== assessment.notes
  const dirty = statusDirty || gradeDirty || dueDirty || notesDirty

  function save() {
    if (!assessment || !dirty) return
    const patch: Partial<Assessment> = {}
    if (statusDirty) patch.status = status
    if (gradeDirty) patch.grade = parsed
    if (dueDirty) patch.due = dueISO
    if (notesDirty) patch.notes = notes
    const prev: Partial<Assessment> = {
      status: assessment.status,
      grade: assessment.grade,
      due: assessment.due,
      notes: assessment.notes,
    }
    updateAssessment(assessment.id, patch)
    closeTarget()
    // Changing a date "broadcasts" the correction back to the section (mocked) —
    // the contribute half of the peer-correction loop.
    const label = dueDirty
      ? `Date shared with your ${course?.code ?? 'class'} section`
      : `Updated ${assessment.title}`
    flashUndo(label, () => updateAssessment(assessment.id, prev))
  }

  function openInCourse() {
    if (!assessment) return
    navigate(`/app/courses/${assessment.courseId}`, { state: { focus: assessment.id } })
    closeTarget()
  }

  return (
    <ModalShell label={`Edit ${assessment.title}`} onClose={closeTarget}>
      <div className="h-1.5" style={{ backgroundColor: hex }} aria-hidden />
      <div className="px-5 py-4">
        <div className="flex items-center gap-2">
          <CourseChip code={course.code} color={course.color} />
          <span className="truncate text-[12px] text-subtle">{course.title}</span>
        </div>
        <h2 className="mt-2 text-[17px] leading-snug font-medium text-fg">
          {assessment.title}
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-subtle">
          <span>{KIND_LABEL[assessment.kind]}</span>
          <span aria-hidden>·</span>
          <span>{assessment.weight}% of grade</span>
          <ProvenanceBadge provenance={assessment.provenance} />
        </div>

        {correction && (
          <div className="mt-4">
            <PeerSuggestion correction={correction} onApplied={setDueISO} />
          </div>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="Status">
            <Select
              ariaLabel="Status"
              value={status}
              onChange={(v) => setStatusDraft(v as AssessmentStatus)}
              tone="control"
              options={EDITOR_STATUSES.map((s) => ({
                value: s,
                label: STATUS_META[s].label,
                dot: STATUS_META[s].dot,
              }))}
            />
          </Field>

          <Field label="Grade">
            <input
              type="text"
              inputMode="decimal"
              value={gradeText}
              placeholder="15/20 or 82"
              aria-label="Grade"
              onChange={(e) => setGradeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) save()
              }}
              className="w-[124px] rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-center text-[14px] font-medium text-fg tabular-nums focus-visible:outline-none"
            />
          </Field>
        </div>

        <p className="mt-2 text-[12px] text-subtle">
          {resolved ? (
            <>
              Resolves to{' '}
              <span className="font-semibold text-fg">{Math.round(pct!)}%</span> ·{' '}
              {resolved.letter} · {resolved.points.toFixed(1)} pts
            </>
          ) : (
            'No grade yet — leave blank to keep it ungraded.'
          )}
        </p>

        <div className="mt-4">
          <Field label="Due date & time">
            <DateTimePicker
              value={dueISO}
              onChange={setDueISO}
              ariaLabel="Due date and time"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Notes">
            <textarea
              value={notes}
              rows={3}
              placeholder="Anything to remember about this one…"
              aria-label="Notes"
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-fg focus-visible:outline-none"
            />
          </Field>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={openInCourse}
            className="inline-flex items-center gap-1 text-[12px] text-subtle transition-colors hover:text-fg"
          >
            Open in course
            <ArrowUpRight size={13} aria-hidden />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeTarget}
              className="rounded-lg px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-contrast shadow-sm transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium tracking-wide text-subtle uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}
