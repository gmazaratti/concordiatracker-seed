import { useEffect, useRef, useState } from 'react'
import { Check, Undo2 } from 'lucide-react'
import type { Grade } from '@/data/types'
import { dismissGradePrompt, markGradeSaved, type PromptKey } from '@/lib/grade-prompt'
import { gradeToPercent, readGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'

/** How long an untouched prompt stays before it gets out of the way. */
const IDLE_MS = 12_000
/** How long "Grade saved · Undo" stays. */
const UNDO_MS = 4_000
/** Matches .ct-grade-out in index.css. */
const EXIT_MS = 180

/**
 * The small "done!" card after ticking something off.
 *
 * One line says it is done (with a run counter when you clear several in a
 * row), one line offers the grade. Every way out is one tap: Save a grade,
 * Later (handed in, the grade comes back later: it waits under "Grades to
 * enter" and stays ticked), or No grade (plenty of things never get one).
 * Ignoring it is the same as No grade: it slips away after a few seconds.
 *
 * NOT A DIALOG: it takes no focus and blocks nothing. The weight of a Moodle
 * item is never demanded: it is shown when the course already knows it, and
 * otherwise offered as an optional link. A grade saved without a weight is
 * recorded and simply does not count toward the average until it has one.
 */
export function GradePromptCard({
  promptKey,
  title,
  behind,
  streak = 1,
  gradeable,
  needsWeight = false,
  knownWeight,
  knownWeightFrom,
  courseCode,
  onSave,
  onUndoGrade,
  onUndoDone,
  onAwaiting,
}: {
  promptKey: PromptKey
  title: string
  behind: number
  /** Ticked off in this burst, this one included. */
  streak?: number
  /** False for a Moodle item with no matching course: only the Undo is offered. */
  gradeable: boolean
  /** A Moodle item becomes an assessment; its weight is optional. */
  needsWeight?: boolean
  knownWeight?: number
  knownWeightFrom?: string
  courseCode?: string
  onSave: (g: Grade, weight?: number) => void | Promise<void>
  onUndoGrade: () => void
  onUndoDone: () => void
  /** "Grade later": handed in, no mark yet. Absent when there is no such state. */
  onAwaiting?: () => void
}) {
  const [text, setText] = useState('')
  const [weightText, setWeightText] = useState(knownWeight != null ? String(knownWeight) : '')
  const [weightOpen, setWeightOpen] = useState(false)
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const read = readGradeInput(text)
  const pct = read.kind === 'grade' ? gradeToPercent(read.grade) : null
  const weight = Number(weightText)
  const weightBlank = weightText.trim() === ''
  const weightOk = !needsWeight || weightBlank || (weight > 0 && weight <= 100)
  const canSave = read.kind === 'grade' && weightOk

  const leave = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => dismissGradePrompt(promptKey), EXIT_MS)
  }

  useEffect(() => {
    if (touched && !saved) return
    timer.current = setTimeout(
      () => {
        setLeaving(true)
        window.setTimeout(() => dismissGradePrompt(promptKey), EXIT_MS)
      },
      saved || !gradeable ? UNDO_MS : IDLE_MS,
    )
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [promptKey, touched, saved, gradeable])

  async function save() {
    const r = readGradeInput(text)
    if (r.kind !== 'grade' || !weightOk) return
    markGradeSaved(promptKey)
    setSaved(true)
    haptic('success')
    await onSave(r.grade, needsWeight ? (weightBlank ? 0 : weight) : undefined)
  }

  function undoGrade() {
    onUndoGrade()
    markGradeSaved(null)
    setSaved(false)
    setTouched(true)
  }

  function undoDone() {
    if (timer.current) clearTimeout(timer.current)
    if (saved) onUndoGrade()
    markGradeSaved(null)
    setLeaving(true)
    window.setTimeout(onUndoDone, EXIT_MS)
  }

  const chip =
    'shrink-0 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg'

  return (
    <div
      className={cn(
        'fixed inset-x-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-[125] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[360px]',
        leaving ? 'ct-grade-out pointer-events-none' : 'ct-grade-in',
      )}
    >
      {behind > 0 && (
        <div aria-hidden className="absolute inset-x-3 -top-1.5 h-full rounded-2xl border border-border bg-surface/70" />
      )}
      <div
        role="status"
        aria-live="polite"
        data-grade-prompt={promptKey}
        className="relative rounded-2xl border border-border bg-surface p-3 shadow-xl"
      >
        <div className="flex items-center gap-2.5">
          <span
            key={streak}
            className="ct-done-pop grid size-7 shrink-0 place-items-center rounded-full bg-success text-accent-contrast"
          >
            <Check size={15} strokeWidth={3} aria-hidden />
          </span>
          <p className="min-w-0 flex-1 truncate text-[13px] text-fg">
            <span className="font-semibold">{saved ? 'Grade saved' : 'Done'}</span>
            <span className="text-muted"> · {title}</span>
          </p>
          {streak > 1 && !saved && (
            <span
              key={`s${streak}`}
              className="ct-done-pop shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[11.5px] font-bold text-success tabular-nums"
            >
              ×{streak}
            </span>
          )}
          <button
            type="button"
            onClick={saved ? undoGrade : undoDone}
            title={saved ? 'Take the grade back' : 'Mark it not done'}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[12.5px] font-medium text-fg hover:bg-surface-2"
          >
            <Undo2 size={13} aria-hidden /> Undo
          </button>
        </div>

        {gradeable && !saved && (
          <>
            <form
              className="mt-2.5 flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                void save()
              }}
            >
              <div className="relative w-[7.5rem] shrink-0">
                <input
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value)
                    setTouched(true)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') leave()
                  }}
                  inputMode="decimal"
                  placeholder="Grade"
                  aria-label={`Your grade for ${title}, for example 85 or 17/20`}
                  aria-invalid={read.kind === 'invalid'}
                  className="h-8 w-full rounded-lg border border-border bg-canvas px-2.5 text-[16px] text-fg outline-none placeholder:text-subtle focus:border-accent sm:text-[13px]"
                />
              </div>
              {pct != null ? (
                <>
                  <span className="shrink-0 text-[12px] font-semibold tabular-nums text-accent">
                    {Math.round(pct)}% {percentToGrade(pct).letter}
                  </span>
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="ml-auto shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-contrast disabled:opacity-40"
                  >
                    Save
                  </button>
                </>
              ) : (
                <div className="ml-auto flex shrink-0 items-center">
                  {onAwaiting && (
                    <button
                      type="button"
                      onClick={() => {
                        onAwaiting()
                        leave()
                      }}
                      title="Handed in, the grade is not back yet. It stays done and waits under Grades to enter."
                      className={chip}
                    >
                      Later
                    </button>
                  )}
                  <button type="button" onClick={leave} title="This one does not get a grade" className={chip}>
                    No grade
                  </button>
                </div>
              )}
            </form>

            {needsWeight &&
              (knownWeight != null && !weightOpen ? (
                <p className="mt-1.5 text-[11.5px] text-subtle">
                  Counts {knownWeight}% of {courseCode ?? 'the course'}, like {knownWeightFrom}.{' '}
                  <button type="button" onClick={() => setWeightOpen(true)} className="underline underline-offset-2 hover:text-fg">
                    Change
                  </button>
                </p>
              ) : weightOpen ? (
                <label className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-subtle">
                  Worth
                  <input
                    value={weightText}
                    onChange={(e) => {
                      setWeightText(e.target.value)
                      setTouched(true)
                    }}
                    inputMode="decimal"
                    aria-label={`What ${title} is worth, as a percentage of your ${courseCode ?? 'course'} grade`}
                    className="h-7 w-14 rounded-md border border-border bg-canvas px-1.5 text-center text-[16px] text-fg outline-none focus:border-accent sm:text-[12px]"
                  />
                  % of {courseCode ?? 'the course'} (optional)
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setWeightOpen(true)}
                  className="mt-1.5 text-[11.5px] text-subtle underline-offset-2 hover:text-fg hover:underline"
                >
                  Know what it is worth? Add it (optional)
                </button>
              ))}
            {read.kind === 'invalid' && <p className="mt-1 text-[11.5px] text-danger">{read.error}</p>}
            {!weightOk && <p className="mt-1 text-[11.5px] text-danger">The weight is a percentage between 0 and 100.</p>}
          </>
        )}
      </div>
    </div>
  )
}
