import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import {
  clearReminder,
  getReminderOffset,
  leadLabel,
  REMINDER_OPTIONS,
  setReminder,
} from '@/lib/reminders'
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
  const [reminderOffset, setReminderOffset] = useState(0)
  const [reminderInitial, setReminderInitial] = useState(0)

  // Load this assignment's saved reminder lead time (async; safe to set in .then).
  useEffect(() => {
    let active = true
    void getReminderOffset('assignment', id).then((o) => {
      if (active) {
        setReminderOffset(o)
        setReminderInitial(o)
      }
    })
    return () => {
      active = false
    }
  }, [id])

  if (!assessment || !course) return null

  const parsed = parseGradeInput(gradeText)
  const pct = gradeToPercent(parsed)
  const resolved = pct === null ? null : percentToGrade(pct)
  const { hex } = courseColor(course.color)

  const statusDirty = status !== assessment.status
  const gradeDirty = gradeToInput(parsed) !== gradeToInput(assessment.grade)
  const dueDirty = !!dueISO && dueISO !== assessment.due
  const notesDirty = notes !== assessment.notes
  const reminderDirty = reminderOffset !== reminderInitial
  const dirty = statusDirty || gradeDirty || dueDirty || notesDirty || reminderDirty

  function save() {
    if (!assessment || !course || !dirty) return

    // Reminder side-write: (re)schedule when set + dated, clear when turned off.
    if (reminderOffset > 0 && dueISO && (reminderDirty || dueDirty)) {
      void setReminder({
        kind: 'assignment',
        refId: assessment.id,
        dueISO,
        offsetMinutes: reminderOffset,
        title: assessment.title,
        body: `${course.code} · due in ${leadLabel(reminderOffset)}`,
        url: `/app/courses/${assessment.courseId}`,
      })
    } else if (reminderOffset === 0 && reminderInitial > 0) {
      void clearReminder('assignment', assessment.id)
    }

    const patch: Partial<Assessment> = {}
    if (statusDirty) patch.status = status
    if (gradeDirty) patch.grade = parsed
    if (dueDirty) patch.due = dueISO
    if (notesDirty) patch.notes = notes

    closeTarget()

    if (Object.keys(patch).length > 0) {
      const prev: Partial<Assessment> = {
        status: assessment.status,
        grade: assessment.grade,
        due: assessment.due,
        notes: assessment.notes,
      }
      updateAssessment(assessment.id, patch)
      // Changing a date "broadcasts" the correction back to the section (mocked) —
      // the contribute half of the peer-correction loop.
      const label = dueDirty
        ? `Date shared with your ${course.code} section`
        : `Updated ${assessment.title}`
      flashUndo(label, () => updateAssessment(assessment.id, prev))
    }
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

        {assessment.description && (
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{assessment.description}</p>
        )}

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
              placeholder="%"
              title="Enter a percent (e.g. 82). Got a score like 15/20? Type it and we'll convert it."
              aria-label="Grade (percent, or a score like 15/20)"
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
            'No grade yet — enter a percent like 82, or a score like 15/20.'
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
          <Field label="Reminder">
            <Select
              ariaLabel="Reminder"
              value={String(reminderOffset)}
              onChange={(v) => setReminderOffset(Number(v))}
              tone="control"
              options={REMINDER_OPTIONS.map((o) => ({ value: String(o.minutes), label: o.label }))}
            />
          </Field>
          {reminderOffset > 0 && !dueISO && (
            <p className="mt-1 text-[12px] text-warning">
              Add a due date so the reminder has a time to fire.
            </p>
          )}
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
