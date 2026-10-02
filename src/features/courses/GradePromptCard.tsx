import { useEffect, useRef, useState } from 'react'
import { Check, Undo2, X } from 'lucide-react'
import type { Grade } from '@/data/types'
import { dismissGradePrompt, markGradeSaved, type PromptKey } from '@/lib/grade-prompt'
import { gradeToPercent, readGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { haptic } from '@/lib/haptics'
import { cn } from '@/lib/cn'

/** How long an untouched prompt stays before it gets out of the way. */
const IDLE_MS = 20_000
/** How long "Grade saved · Undo" (or a bare "Marked done · Undo") stays. */
const UNDO_MS = 5_000
/** Matches .ct-grade-out in index.css. */
const EXIT_MS = 180

/**
 * The small "what did you get?" card after marking something done.
 *
 * NOT A DIALOG: it takes no focus, blocks nothing, and leaves by itself after
 * 20 seconds if ignored. Typing into it pauses that timer. It takes the same
 * input the course editor does: `85`, `85%` or `17/20`.
 *
 * Two undos, for two different mistakes: the one in the header takes the TICK
 * back (marked the wrong row), the one after saving takes the GRADE back
 * (typed 58 for 85). Several completions queue; the rest of the line peeks out
 * behind as a stack and the first line says how many are waiting.
 */
export function GradePromptCard({
  promptKey,
  title,
  behind,
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
  /** False for a Moodle item with no matching course: only the Undo is offered. */
  gradeable: boolean
  /** A Moodle item becomes an assessment, which needs to know what it is worth. */
  needsWeight?: boolean
  /** The weight the course's similar items all share, when they agree. It is
   *  shown as a fact with a Change link, not put in a box to fill in. */
  knownWeight?: number
  /** What it was taken from ("your other quizzes"), for the sentence. */
  knownWeightFrom?: string
  courseCode?: string
  onSave: (g: Grade, weight?: number) => void | Promise<void>
  onUndoGrade: () => void
  onUndoDone: () => void
  /** "Handed in, no mark yet": keeps it on Today under Waiting for a grade.
   *  Absent when it is already in that state. */
  onAwaiting?: () => void
}) {
  const [text, setText] = useState('')
  const [weightText, setWeightText] = useState(knownWeight != null ? String(knownWeight) : '')
  const [editingWeight, setEditingWeight] = useState(knownWeight == null)
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const read = readGradeInput(text)
  const pct = read.kind === 'grade' ? gradeToPercent(read.grade) : null
  const weight = Number(weightText)
  const weightOk = !needsWeight || (weightText.trim() !== '' && weight > 0 && weight <= 100)
  const canSave = read.kind === 'grade' && weightOk

  // One way out, whatever the reason: play the exit, then take it off the line
  // (which mounts the next question, if there is one).
  const leave = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => dismissGradePrompt(promptKey), EXIT_MS)
  }

  // Idle timeout while unanswered; the undo window once saved or when there is
  // nothing to ask (a Moodle item with no course to grade into).
  useEffect(() => {
    if (touched && !saved) return
    const quick = saved || !gradeable
    timer.current = setTimeout(
      () => {
        setLeaving(true)
        window.setTimeout(() => dismissGradePrompt(promptKey), EXIT_MS)
      },
      quick ? UNDO_MS : IDLE_MS,
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
    await onSave(r.grade, needsWeight ? weight : undefined)
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

  return (
    <div
      className={cn(
        'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 z-[125] mx-auto max-w-sm md:bottom-6',
        leaving ? 'ct-grade-out pointer-events-none' : 'ct-grade-in',
      )}
    >
      {behind > 0 && (
        <>
          <div aria-hidden className="absolute inset-x-3 -top-1.5 h-full rounded-2xl border border-border bg-surface/80" />
          {behind > 1 && (
            <div aria-hidden className="absolute inset-x-6 -top-3 h-full rounded-2xl border border-border bg-surface/60" />
          )}
        </>
      )}
      <div
        role="status"
        aria-live="polite"
        data-grade-prompt={promptKey}
        className="relative rounded-2xl border border-border bg-surface p-3 shadow-lg"
      >
        {saved ? (
          <div className="flex items-center gap-2">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium text-success">
              <Check size={15} aria-hidden /> Grade saved
            </p>
            <UndoButton onClick={undoGrade} label="Undo" />
            <CloseButton onClick={leave} label="Close" />
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <p className="flex min-w-0 flex-1 items-start gap-1.5 text-[13px] text-fg">
                <Check size={15} className="mt-px shrink-0 text-success" aria-hidden />
                <span className="min-w-0">
                  <span className="font-medium">{title}</span> <span className="text-muted">marked done</span>
                  {behind > 0 && <span className="ml-1 text-[11.5px] text-subtle">({behind} more after this)</span>}
                </span>
              </p>
              <UndoButton onClick={undoDone} label="Undo" title="Mark it not done" />
              <CloseButton onClick={leave} label={gradeable ? 'Skip entering a grade' : 'Close'} />
            </div>
            {gradeable && (
              <form
                className="mt-2.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  void save()
                }}
              >
                <div className="flex items-center gap-2">
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
                    placeholder="Your grade, e.g. 85 or 17/20"
                    aria-label={`Your grade for ${title}`}
                    aria-invalid={read.kind === 'invalid'}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-border-strong"
                  />
                  {pct != null && (
                    <span className="shrink-0 text-[12px] tabular-nums text-subtle" aria-live="polite">
                      {Math.round(pct)}% {percentToGrade(pct).letter}
                    </span>
                  )}
                  <button
                    type="submit"
                    disabled={!canSave}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-opacity duration-150 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                {needsWeight &&
                  (editingWeight ? (
                    <label className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
                      Worth
                      <input
                        value={weightText}
                        onChange={(e) => {
                          setWeightText(e.target.value)
                          setTouched(true)
                        }}
                        inputMode="decimal"
                        aria-label={`What ${title} is worth, as a percentage of your ${courseCode ?? 'course'} grade`}
                        className="w-14 rounded-lg border border-border bg-canvas px-2 py-1 text-center text-[13px] text-fg outline-none focus:border-border-strong"
                      />
                      % of your {courseCode ?? 'course'} grade
                    </label>
                  ) : (
                    <p className="mt-2 text-[12px] text-subtle">
                      Counts for {knownWeight}% of {courseCode ?? 'the course'}, like {knownWeightFrom}.{' '}
                      <button
                        type="button"
                        onClick={() => setEditingWeight(true)}
                        className="text-muted underline underline-offset-2 hover:text-fg"
                      >
                        Change
                      </button>
                    </p>
                  ))}
              </form>
            )}
            {gradeable && onAwaiting && (
              <button
                type="button"
                onClick={() => {
                  onAwaiting()
                  leave()
                }}
                className="mt-2 text-[12px] text-subtle underline-offset-2 transition-colors duration-150 hover:text-fg hover:underline"
              >
                No grade yet: I'm waiting for it
              </button>
            )}
            {read.kind === 'invalid' && <p className="mt-1.5 text-[11.5px] text-danger">{read.error}</p>}
            {needsWeight && gradeable && weightText.trim() !== '' && !weightOk && (
              <p className="mt-1.5 text-[11.5px] text-danger">The weight is a percentage between 0 and 100.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function UndoButton({ onClick, label, title }: { onClick: () => void; label: string; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-fg hover:bg-surface-2"
    >
      <Undo2 size={13} aria-hidden /> {label}
    </button>
  )
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
    >
      <X size={15} aria-hidden />
    </button>
  )
}
