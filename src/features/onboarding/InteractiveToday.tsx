import { useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Slide } from './OnboardingSlides'

interface DemoItem {
  id: string
  title: string
  code: string
  color: string
  due: string
  dueTone: string
}

const ITEMS: DemoItem[] = [
  { id: 't1', title: 'Reading response 1', code: 'POLI 202', color: '#e0698c', due: 'Due 2 days ago', dueTone: 'text-danger' },
  { id: 't2', title: 'Quiz 3 — Markets', code: 'COMM 221', color: '#e8b84b', due: 'Due tomorrow', dueTone: 'text-warning' },
  { id: 't3', title: 'Assignment 2 — Linked lists', code: 'COMP 248', color: '#5aa9f0', due: 'Due in 2 days', dueTone: 'text-fg' },
]

/** Interactive Today step — the user checks an assignment off to advance. A
 * purpose-built, properly-sized mini-Today (not the scaled-down landing preview,
 * which read as zoomed-in here). */
export function TodayStep({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState<Set<string>>(new Set())
  const check = (id: string) =>
    setDone((prev) => {
      if (prev.has(id)) return prev
      if (prev.size === 0) onDone() // first check unlocks Continue
      return new Set(prev).add(id)
    })

  const any = done.size > 0
  const remaining = ITEMS.length - done.size

  return (
    <Slide
      visual={<MiniToday done={done} onCheck={check} hint={!any} remaining={remaining} />}
      headline="It all lands on Today"
      sub={
        any
          ? 'Nice — checking things off is how you stay on top of the week.'
          : 'Try it: tap a circle to check an assignment off.'
      }
    />
  )
}

function MiniToday({
  done,
  onCheck,
  hint,
  remaining,
}: {
  done: Set<string>
  onCheck: (id: string) => void
  hint: boolean
  remaining: number
}) {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface text-left">
      <div className="border-b border-border px-4 py-3">
        <p className="text-[11px] text-subtle">Saturday, June 20</p>
        <p className="font-display text-[16px] font-medium text-fg">Good morning, Alex</p>
      </div>

      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-semibold tracking-wide text-subtle uppercase">Due</span>
        <span className="text-[10px] text-subtle">
          {done.size} done · {remaining} to go
        </span>
      </div>

      <ul className="divide-y divide-border px-1.5 pb-2">
        {ITEMS.map((it) => {
          const isDone = done.has(it.id)
          return (
            <li key={it.id} className="flex items-center gap-2.5 px-2.5 py-2.5">
              <button
                type="button"
                onClick={() => onCheck(it.id)}
                aria-label={isDone ? `${it.title} done` : `Mark ${it.title} done`}
                aria-pressed={isDone}
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-150',
                  isDone
                    ? 'border-accent bg-accent text-accent-contrast'
                    : cn('border-border-strong text-transparent hover:border-accent', hint && 'animate-pulse ring-2 ring-accent/50'),
                )}
              >
                <Check size={12} strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-[13px] font-medium', isDone ? 'text-subtle line-through' : 'text-fg')}>
                  {it.title}
                </p>
                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-subtle">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: it.color }} aria-hidden />
                  {it.code}
                </span>
              </div>
              <span className={cn('shrink-0 text-[11px] font-semibold', isDone ? 'text-subtle' : it.dueTone)}>
                {isDone ? 'Done' : it.due}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
