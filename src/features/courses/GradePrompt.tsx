import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { closeGradePrompt, useGradePromptId } from '@/lib/grade-prompt'
import { gradeToPercent, readGradeInput } from '@/lib/grade'
import { percentToGrade } from '@/lib/gpa'

/** How long an untouched prompt stays before it gets out of the way. */
const IDLE_MS = 20_000

/**
 * The small "what did you get?" card after marking something done.
 *
 * NOT A DIALOG: it takes no focus, blocks nothing, and leaves by itself after
 * 20 seconds if ignored. Typing into it pauses that timer. It only appears for
 * an assessment that has no grade yet (lib/grade-prompt decides nothing else),
 * and it takes the same input the course editor does: `85`, `85%` or `17/20`.
 */
export function GradePrompt() {
  const id = useGradePromptId()
  const { assessments, setGrade } = useAppData()
  const item = id ? assessments.find((a) => a.id === id) : undefined
  // Remount per assessment so the field starts empty for each new question.
  if (!item || item.grade) return null
  return <Card key={item.id} id={item.id} title={item.title} onSave={(g) => setGrade(item.id, g)} />
}

function Card({ id, title, onSave }: { id: string; title: string; onSave: (g: NonNullable<ReturnType<typeof toGrade>>) => void }) {
  const [text, setText] = useState('')
  const [touched, setTouched] = useState(false)
  const [saved, setSaved] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const read = readGradeInput(text)
  const pct = read.kind === 'grade' ? gradeToPercent(read.grade) : null

  useEffect(() => {
    if (touched) return
    timer.current = setTimeout(closeGradePrompt, IDLE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [touched])

  function save() {
    const g = toGrade(text)
    if (!g) return
    onSave(g)
    setSaved(true)
    setTimeout(closeGradePrompt, 1200)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      data-grade-prompt={id}
      className="ct-animate-pop fixed right-4 bottom-20 left-4 z-[125] mx-auto max-w-sm rounded-2xl border border-border bg-surface p-3 shadow-lg md:bottom-6"
    >
      {saved ? (
        <p className="flex items-center gap-2 text-[13px] font-medium text-success">
          <Check size={15} aria-hidden /> Grade saved
        </p>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-[13px] text-fg">
              <span className="font-medium">Done: {title}.</span>{' '}
              <span className="text-muted">Got a grade yet?</span>
            </p>
            <button
              type="button"
              onClick={closeGradePrompt}
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
                if (e.key === 'Escape') closeGradePrompt()
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
              onClick={closeGradePrompt}
              className="rounded-lg px-2 py-1.5 text-[12.5px] font-medium text-muted hover:text-fg"
            >
              Skip
            </button>
          </form>
          {read.kind === 'invalid' && <p className="mt-1.5 text-[11.5px] text-danger">{read.error}</p>}
        </>
      )}
    </div>
  )
}

function toGrade(text: string) {
  const r = readGradeInput(text)
  return r.kind === 'grade' ? r.grade : null
}
