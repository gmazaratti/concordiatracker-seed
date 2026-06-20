import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Slide } from './OnboardingSlides'

type StatusId = 'not-started' | 'done' | 'late' | 'missed'

const STATUSES: { id: StatusId; label: string; text: string; dot: string }[] = [
  { id: 'not-started', label: 'Not started', text: 'text-subtle', dot: 'bg-border-strong' },
  { id: 'done', label: 'Done', text: 'text-success', dot: 'bg-success' },
  { id: 'late', label: 'Done late', text: 'text-warning', dot: 'bg-warning' },
  { id: 'missed', label: 'Missed', text: 'text-danger', dot: 'bg-danger' },
]

const metaOf = (id: StatusId) => STATUSES.find((s) => s.id === id)!

/** Interactive Editing step — open an assignment and mark it to advance. */
export function EditingStep({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<StatusId>('not-started')
  const [grade, setGrade] = useState('')
  const [marked, setMarked] = useState(false)

  const pick = (id: StatusId) => {
    setStatus(id)
    if (id !== 'not-started' && !marked) {
      setMarked(true)
      onDone() // first real mark unlocks Continue
    }
  }

  return (
    <Slide
      visual={
        <MiniEditor
          open={open}
          onToggle={() => setOpen((o) => !o)}
          status={status}
          onPick={pick}
          grade={grade}
          setGrade={setGrade}
          hint={!open && !marked}
        />
      }
      headline="Edit anything, mark as you go"
      sub={
        marked
          ? 'That’s it — set a grade or notes the same way, any time. Overdue is worked out from the date for you.'
          : open
            ? 'Pick a status to mark it — try “Done”.'
            : 'Tap the assignment to open it.'
      }
    />
  )
}

function MiniEditor({
  open,
  onToggle,
  status,
  onPick,
  grade,
  setGrade,
  hint,
}: {
  open: boolean
  onToggle: () => void
  status: StatusId
  onPick: (id: StatusId) => void
  grade: string
  setGrade: (v: string) => void
  hint: boolean
}) {
  const meta = metaOf(status)
  const isDone = status === 'done'

  return (
    <div
      className={cn(
        'w-full max-w-md overflow-hidden rounded-2xl border bg-surface text-left transition-colors',
        hint ? 'border-accent/60' : 'border-border',
      )}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-[13px] font-medium', isDone ? 'text-subtle line-through' : 'text-fg')}>
            Assignment 2 — Linked lists
          </p>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
            <span className="size-1.5 rounded-full bg-info" aria-hidden />
            COMP 248 · 10%
            {grade && <span className="text-fg">· {grade}</span>}
          </span>
        </div>
        {status !== 'not-started' && (
          <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', meta.text)}>
            <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
            {meta.label}
          </span>
        )}
        <ChevronDown size={15} className={cn('shrink-0 text-subtle transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border px-4 py-3.5">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => {
                const active = s.id === status
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onPick(s.id)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors',
                      active ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:border-border-strong',
                    )}
                  >
                    <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden />
                    {s.label}
                    {active && <Check size={12} className="text-accent" aria-hidden />}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">Grade</p>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="e.g. 18/20 or 90%"
              className="w-full max-w-[200px] rounded-lg border border-border bg-canvas px-3 py-2 text-[13px] text-fg placeholder:text-subtle outline-none focus:border-border-strong"
            />
          </div>
        </div>
      )}
    </div>
  )
}
