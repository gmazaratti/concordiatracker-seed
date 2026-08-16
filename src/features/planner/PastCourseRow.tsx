import { useState } from 'react'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import type { Course } from '@/data/types'
import { useAppData } from '@/app/providers/app-data'
import { GradeField } from '@/components/ui/GradeField'
import { Select } from '@/components/ui/Select'
import { isNotation, parseFinalGrade, percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'
import { allTerms, isUpcomingTerm } from './past-terms'

/** Credit values Concordia actually uses. A free text box here invites "3.0 "
 *  and "three"; the real set is short. */
const CREDIT_OPTIONS = ['1', '1.5', '2', '3', '3.5', '4', '6']

/**
 * One finished course, editable in place.
 *
 * Rebuilding a transcript from memory means getting things wrong, so every
 * field that was entered has to be changeable afterwards: a mistyped grade, a
 * course filed under the wrong term, the wrong credit count. Previously the
 * only correction available was deleting the row and starting again.
 */
export function PastCourseRow({ course, superseded }: { course: Course; superseded: boolean }) {
  const { updateCourse, removeCourse } = useAppData()
  const [editing, setEditing] = useState(false)
  const [grade, setGrade] = useState(
    course.finalLetter ??
      (typeof course.finalPercent === 'number' ? String(course.finalPercent) : ''),
  )
  const [term, setTerm] = useState(course.term)
  const [credits, setCredits] = useState(String(course.credits))

  const percent = grade.trim() === '' ? null : parseFinalGrade(grade)
  const gradeOk = grade.trim() === '' || percent !== null

  function save() {
    if (!gradeOk) return
    updateCourse(course.id, {
      term,
      // Moving a course to an upcoming term moves it OUT of history: it stops
      // being a finished course and becomes one you are about to take.
      archived: !isUpcomingTerm(term),
      credits: Number(credits) || course.credits,
      finalPercent: percent ?? undefined,
      // A notation keeps its own name. Deriving the letter from the percentage
      // would turn every FNS into an F, which is a different thing on a
      // transcript even though both are worth 0.00.
      finalLetter:
        percent === null
          ? undefined
          : isNotation(grade)
            ? grade.trim().toUpperCase()
            : percentToGrade(percent).letter,
    })
    setEditing(false)
  }

  function cancel() {
    setGrade(
      course.finalLetter ??
        (typeof course.finalPercent === 'number' ? String(course.finalPercent) : ''),
    )
    setTerm(course.term)
    setCredits(String(course.credits))
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="bg-surface-2/60 px-4 py-2.5">
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_150px_110px_120px_auto]">
          <span className="flex items-center text-[13px] font-medium text-fg">{course.code}</span>
          <Select
            value={term}
            onChange={setTerm}
            ariaLabel={`Term for ${course.code}`}
            options={[...new Set([course.term, ...allTerms()])].map((t) => ({
              value: t,
              label: isUpcomingTerm(t) ? `${t} · upcoming` : t,
            }))}
          />
          <Select
            value={credits}
            onChange={setCredits}
            ariaLabel={`Credits for ${course.code}`}
            options={[...new Set([String(course.credits), ...CREDIT_OPTIONS])].map((c) => ({
              value: c,
              label: `${c} cr`,
            }))}
          />
          <GradeField
            value={grade}
            onChange={setGrade}
            ariaLabel={`Grade for ${course.code}`}
            placeholder="Grade"
          />
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={save}
              disabled={!gradeOk}
              aria-label="Save"
              className="grid size-8 place-items-center rounded-md bg-accent text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-40"
            >
              <Check size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={cancel}
              aria-label="Cancel"
              className="grid size-8 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface hover:text-fg"
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        </div>
      </li>
    )
  }

  const shown =
    course.finalLetter ??
    (typeof course.finalPercent === 'number' ? percentToGrade(course.finalPercent).letter : null)

  return (
    <li className={cn('group flex items-center gap-3 px-4 py-2.5', superseded && 'opacity-60')}>
      <span className="min-w-0 flex-1">
        {/* Code and title on one line that truncates, rather than a flex child
            that wraps "COMM" onto its own row and leaves "316" beneath it. */}
        <span className="block truncate text-[13.5px] text-fg">
          <span className="font-medium">{course.code}</span>
          {course.title && <span className="ml-2 text-[12px] text-subtle">{course.title}</span>}
        </span>
        {/* Named, not hidden: the attempt happened and stays on the transcript,
            it just stops counting toward the GPA. */}
        {superseded && (
          <span className="mt-0.5 inline-block rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-subtle">
            Repeated later, not counted
          </span>
        )}
      </span>
      <span className="hidden shrink-0 text-[12px] text-subtle tabular-nums sm:block">
        {course.credits} cr
      </span>
      <span className="w-10 shrink-0 text-right text-[13px] font-medium text-fg sm:w-14">
        {shown ?? <span className="text-subtle">&mdash;</span>}
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Edit ${course.code}`}
        className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        <Pencil size={13} aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => removeCourse(course.id)}
        aria-label={`Remove ${course.code}`}
        className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
      >
        <Trash2 size={13} aria-hidden />
      </button>
    </li>
  )
}
