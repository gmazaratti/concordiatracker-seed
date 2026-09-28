import { useEffect, useRef, useState } from 'react'
import { Check, Undo2, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import type { Grade } from '@/data/types'
import { dismissGradePrompt, markGradeSaved, useGradePrompts } from '@/lib/grade-prompt'
import { gradeToPercent, readGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'
import { cn } from '@/lib/cn'

/** How long an untouched prompt stays before it gets out of the way. */
const IDLE_MS = 20_000
/** How long "Grade saved · Undo" stays: long enough to notice a typo. */
const UNDO_MS = 5_000
/** Matches .ct-grade-out in index.css. */
const EXIT_MS = 180

/**
 * The small "what did you get?" card after marking something done.
 *
 * NOT A DIALOG: it takes no focus, blocks nothing, and leaves by itself after
 * 20 seconds if ignored. Typing into it pauses that timer. It only asks about
 * an assessment with no grade yet, and takes the same input the course editor
 * does: `85`, `85%` or `17/20`.
 *
 * Several completions queue (lib/grade-prompt): the card shows the first, says
 * how many are waiting, and draws the rest as a stack behind it. Saving leaves
 * an Undo for a few seconds, because the grade is written the moment you press
 * Save and a mistyped 58 for 85 is exactly the mistake that goes unnoticed.
 */
export function GradePrompt() {
  const { queue, saved } = useGradePrompts()
  const { assessments, setGrade } = useAppData()
  const byId = new Map(assessments.map((a) => [a.id, a]))
  // Graded somewhere else in the meantime, or deleted: no longer a question.
  // The one just saved stays, for its Undo.
  const waiting = queue.filter((id) => {
    const a = byId.get(id)
    return a && (!a.grade || id === saved)
  })
  const head = waiting[0] ? byId.get(waiting[0]) : undefined
  if (!head) return null
  return (
    <Card
      // Remount per assessment so the field starts empty and the entrance plays.
      key={head.id}
      id={head.id}
      title={head.title}
      behind={waiting.length - 1}
      onSave={(g) => setGrade(head.id, g)}
      onUndo={() => setGrade(head.id, null)}
    />
  )
}

function Card({
  id,
  title,
  behind,
  onSave,
  onUndo,
}: {
  id: string
  title: string
  behind: number
  onSave: (g: Grade) => void
  onUndo: () => void
}) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const read = readGradeInput(text)
  const pct = read.kind === 'grade' ? gradeToPercent(read.grade) : null

  // One way out, whatever the reason: play the exit, then take it off the line
  // (which mounts the next question, if there is one).
  const leave = () => {
    if (leaving) return
    setLeaving(true)
    window.setTimeout(() => dismissGradePrompt(id), EXIT_MS)
  }

  // Idle timeout while unanswered; the undo window once saved.
  useEffect(() => {
    if (touched && !saved) return
    timer.current = setTimeout(
      () => {
        setLeaving(true)
        window.setTimeout(() => dismissGradePrompt(id), EXIT_MS)
      },
      saved ? UNDO_MS : IDLE_MS,
    )
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [id, touched, saved])

  function save() {
    const r = readGradeInput(text)
    if (r.kind !== 'grade') return
    markGradeSaved(id)
    onSave(r.grade)
    setSaved(true)
  }

  function undo() {
    onUndo()
    markGradeSaved(null)
    setSaved(false)
    setTouched(true)
  }

  return (
    <div
      className={cn(
        'fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] left-4 z-[125] mx-auto max-w-sm md:bottom-6',
        leaving ? 'ct-grade-out pointer-events-none' : 'ct-grade-in',
      )}
    >
      {/* The rest of the line, as cards peeking out behind this one. */}
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
        data-grade-prompt={id}
        className="relative rounded-2xl border border-border bg-surface p-3 shadow-lg"
      >
        {saved ? (
          <div className="flex items-center gap-2">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium text-success">
              <Check size={15} aria-hidden /> Grade saved
            </p>
            <button
              type="button"
              onClick={undo}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-fg hover:bg-surface-2"
            >
              <Undo2 size={14} aria-hidden /> Undo
            </button>
            <button
              type="button"
              onClick={leave}
              aria-label="Close"
              className="grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
            >
              <X size={15} aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-[13px] text-fg">
                <span className="font-medium">Done: {title}.</span>{' '}
                <span className="text-muted">Got a grade yet?</span>
                {behind > 0 && (
                  <span className="ml-1 text-[11.5px] text-subtle">({behind} more after this)</span>
                )}
              </p>
              <button
                type="button"
                onClick={leave}
                aria-label="Skip entering a grade"
                className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
              >
                <X size={15} aria-hidden />
              </button>
            </div>
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                save()
              }}
            >
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
                placeholder="85 or 17/20"
                aria-label={`Grade for ${title}`}
                aria-invalid={read.kind === 'invalid'}
                className="w-28 min-w-0 flex-1 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-[13px] text-fg outline-none placeholder:text-subtle focus:border-border-strong"
              />
              <span className="w-14 shrink-0 text-[12px] tabular-nums text-subtle" aria-live="polite">
                {pct != null ? `${Math.round(pct)}% ${percentToGrade(pct).letter}` : ''}
              </span>
              <button
                type="submit"
                disabled={read.kind !== 'grade'}
                className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={leave}
                className="rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-muted hover:text-fg"
              >
                Skip
              </button>
            </form>
            {read.kind === 'invalid' && <p className="mt-1.5 text-[11.5px] text-danger">{read.error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
