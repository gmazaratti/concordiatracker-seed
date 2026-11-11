import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import type { Assessment, AssessmentStatus } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { useQuickActions } from '@/app/providers/quick-actions'
import { ReminderChips } from '@/features/reminders/ReminderChips'
import { useReminderPrefs } from '@/features/reminders/useReminderPrefs'
import { AssessmentNativeActions } from '@/features/reminders/AssessmentNativeActions'
import { CourseChip } from '@/components/CourseChip'
import { ProvenanceBadge } from '@/components/ProvenanceBadge'
import { PeerSuggestion } from '@/components/PeerSuggestion'
import { EDITOR_STATUSES, STATUS_META } from '@/lib/status'
import { KIND_LABEL } from '@/lib/assessment'
import { cn } from '@/lib/cn'
import { gradeToInput, gradeToPercent, readGradeInput } from '@/lib/grade'
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
  // null is a real value here: an item whose date the syllabus never gave.
  const [dueISO, setDueISO] = useState<string | null>(assessment?.due ?? null)
  const [noDate, setNoDate] = useState(!!assessment?.noDate)
  const [notes, setNotes] = useState(assessment?.notes ?? '')
  const [reminders, setReminders] = useState<number[]>(assessment?.reminders ?? [])
  // Excused: which assessment takes over this one's weight ('' = none).
  const [weightTo, setWeightTo] = useState(assessment?.weightTo ?? '')
  const [prefs] = useReminderPrefs()

  if (!assessment || !course) return null

  const read = readGradeInput(gradeText)
  const parsed = read.kind === 'grade' ? read.grade : null
  // "abc" is not "no grade": treating it as one saved over a real 82%.
  const gradeError = read.kind === 'invalid' ? read.error : null
  const pct = gradeToPercent(parsed)
  const resolved = pct === null ? null : percentToGrade(pct)
  const { hex } = courseColor(course.color)

  const statusDirty = status !== assessment.status
  const gradeDirty = gradeError !== null || gradeToInput(parsed) !== gradeToInput(assessment.grade)
  const dueDirty = dueISO !== assessment.due
  const noDateDirty = noDate !== !!assessment.noDate
  const notesDirty = notes !== assessment.notes
  const reminderDirty = reminders.join(',') !== (assessment.reminders ?? []).join(',')
  const weightToDirty = (status === 'excused' ? weightTo : '') !== (assessment.weightTo ?? '')
  const dirty = statusDirty || gradeDirty || dueDirty || noDateDirty || notesDirty || reminderDirty || weightToDirty
  // Where the weight could go: the course's other assessments that will be graded.
  const siblings = assessments.filter(
    (a) => a.courseId === assessment.courseId && a.id !== assessment.id && a.status !== 'excused',
  )

  function save() {
    if (!assessment || !course || !dirty || gradeError) return

    const patch: Partial<Assessment> = {}
    if (statusDirty) patch.status = status
    if (gradeDirty) patch.grade = parsed
    if (dueDirty) patch.due = dueISO
    if (noDateDirty) patch.noDate = noDate
    if (notesDirty) patch.notes = notes
    if (reminderDirty) patch.reminders = reminders
    if (weightToDirty) patch.weightTo = status === 'excused' && weightTo ? weightTo : null

    closeTarget()

    if (Object.keys(patch).length > 0) {
      const prev: Partial<Assessment> = {
        status: assessment.status,
        grade: assessment.grade,
        due: assessment.due,
        noDate: !!assessment.noDate,
        notes: assessment.notes,
        reminders: assessment.reminders ?? [],
        weightTo: assessment.weightTo ?? null,
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
      {/* The course colour as a slim left rule rather than a band across the
          top, which ran under the sheet's grabber and close button. */}
      <div className="border-l-4 px-5 pt-4 pb-0" style={{ borderLeftColor: hex }}>
        <div className="flex items-center gap-2 pr-9">
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
              placeholder="e.g. 85"
              title="Enter a percent (e.g. 82). Got a score like 15/20? Type it and we'll convert it."
              aria-label="Grade (percent, or a score like 15/20)"
              aria-invalid={gradeError !== null}
              onChange={(e) => setGradeText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) save()
              }}
              className={cn(
                'h-10 w-[96px] rounded-lg border bg-surface-2 px-2 text-center text-[16px] font-medium text-fg tabular-nums focus-visible:outline-none sm:text-[14px]',
                gradeError ? 'border-danger' : 'border-border-strong',
              )}
            />
          </Field>
        </div>

        {(gradeError || resolved) && (
          <p className={cn('mt-1.5 text-right text-[12px]', gradeError ? 'text-danger' : 'text-subtle')} role={gradeError ? 'alert' : undefined}>
            {gradeError ? (
              gradeError
            ) : (
              <>
                <span className="font-semibold text-fg">{Math.round(pct!)}%</span> · {resolved!.letter} ·{' '}
                {resolved!.points.toFixed(1)} pts
              </>
            )}
          </p>
        )}

        {status === 'excused' && (
          <div className="mt-3 rounded-lg border border-border bg-surface-2/50 px-3 py-2.5">
            <p className="text-[12.5px] text-fg">
              No grade for this one. Its {assessment.weight}% can move to another assessment, like when a missed
              midterm counts toward the final.
            </p>
            <div className="mt-2">
              <Select
                ariaLabel="Move its weight to"
                value={weightTo}
                onChange={setWeightTo}
                tone="control"
                options={[
                  { value: '', label: 'Leave it out of the grade' },
                  ...siblings.map((a) => ({ value: a.id, label: `Add to ${a.title} (${a.weight}% → ${a.weight + assessment.weight}%)` })),
                ]}
              />
            </div>
          </div>
        )}

        <div className="mt-4">
          <Field label="Due date & time">
            <DateTimePicker
              value={dueISO}
              noDate={noDate}
              onNoDate={setNoDate}
              clearable
              onChange={setDueISO}
              ariaLabel="Due date and time"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Reminders">
            <ReminderChips
              value={reminders}
              onChange={setReminders}
              defaults={prefs.defaults}
              enabled={prefs.enabled}
            />
          </Field>
          {!dueISO && (
            <p className="mt-1 text-[12px] text-warning">
              Add a due date so the reminders have a time to fire.
            </p>
          )}
        </div>

        <div className="mt-4">
          <Field label="Notes">
            <textarea
              value={notes}
              rows={2}
              placeholder="Anything to remember about this one…"
              aria-label="Notes"
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-fg focus-visible:outline-none"
            />
          </Field>
        </div>

        <AssessmentNativeActions assessment={assessment} course={course} />

        {/* Pinned to the bottom of the sheet: on a phone Save used to sit below
            the fold, under the notes. */}
        <div className="sticky bottom-0 z-10 -mx-5 mt-5 flex items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
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
              disabled={!dirty || gradeError !== null}
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
