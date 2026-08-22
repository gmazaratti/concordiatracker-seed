import { useState } from 'react'
import { CheckCircle2, Flag, Loader2 } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { fileDataReport, REPORTABLE_FIELDS } from '@/lib/data-reports'
import type { Course } from '@/data/types'

/**
 * "This is wrong."
 *
 * Nearly everything in the class-details panel came from a mirror of Concordia's
 * calendar, which is only as fresh as the last sync and was never promised to be
 * right. The student is looking at their own portal; they are the better source.
 *
 * Two things happen and they are kept apart on purpose. The student can fix the
 * field for themselves immediately — every row in that panel is editable, and
 * this modal says so — and the report is what lets the mirror catch up for
 * everyone else. Filing one is never a prerequisite for getting on with your day.
 */
export function ReportDataModal({
  course,
  field: initialField,
  onClose,
}: {
  course: Course
  field?: string
  onClose: () => void
}) {
  const [field, setField] = useState(initialField ?? 'meetingTimes')
  const [suggested, setSuggested] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const current = currentValue(course, field)

  async function submit() {
    if (busy) return
    setBusy(true)
    await fileDataReport({
      kind: 'course_info',
      courseCode: course.code,
      courseId: course.id,
      field,
      currentValue: current,
      suggestedValue: suggested.trim() || undefined,
      note: note.trim() || undefined,
      payload: { term: course.term, section: course.section },
    })
    setBusy(false)
    setDone(true)
  }

  return (
    <ModalShell label="Report incorrect information" onClose={onClose} widthClass="sm:max-w-md">
      <div className="p-4 sm:p-5">
        {done ? (
          <div className="py-4 text-center">
            <CheckCircle2 size={26} className="mx-auto text-success" aria-hidden />
            <p className="mt-3 text-[15px] font-medium text-fg">Thanks — that&rsquo;s logged</p>
            <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-relaxed text-subtle">
              We&rsquo;ll check it against Concordia and fix the source. Your own copy is still
              yours to edit in the meantime.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 className="flex items-center gap-2 font-display text-[17px] font-medium text-fg">
              <Flag size={15} className="text-warning" aria-hidden />
              Something here is wrong
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-subtle">
              For {course.code || 'this class'}. Every field in the panel is editable, so fix yours
              straight away — this is how the copy everyone else sees gets fixed too.
            </p>

            <label className="mt-4 block">
              <span className="mb-1 block text-[11.5px] text-subtle">Which field</span>
              <Select value={field} onChange={setField} ariaLabel="Field" options={REPORTABLE_FIELDS} />
            </label>

            {current && (
              <p className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
                <span className="text-subtle">We show:</span> {current}
              </p>
            )}

            <label className="mt-3 block">
              <span className="mb-1 block text-[11.5px] text-subtle">
                What it should say <span className="text-subtle">(optional)</span>
              </span>
              <input
                value={suggested}
                onChange={(e) => setSuggested(e.target.value)}
                placeholder="e.g. Mon · Wed 13:15–14:30"
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-[11.5px] text-subtle">
                Anything else <span className="text-subtle">(optional)</span>
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Where did you see the right version?"
                className="w-full resize-none rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
              >
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden />}
                Send report
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}

/** What we currently show for that field, so the report carries both sides and
 *  an admin can tell a stale mirror from a student's typo. */
function currentValue(c: Course, field: string): string {
  switch (field) {
    case 'meetingTimes':
      return c.meetingTimes
    case 'location':
      return c.location
    case 'section':
      return c.section
    case 'instructor':
      return c.instructor.name
    case 'credits':
      return String(c.credits)
    case 'title':
      return c.title
    default:
      return ''
  }
}
