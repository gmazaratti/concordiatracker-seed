import { Link } from 'react-router-dom'
import { Check, ChevronRight, X } from 'lucide-react'
import { Confetti } from '@/components/Confetti'
import { Mascot } from '@/components/Mascot'
import { cn } from '@/lib/cn'

export interface Step {
  id: string
  label: string
  hint: string
  done: boolean
  to: string
}

/**
 * One line of the checklist.
 *
 * `fresh` is the moment a step is finished while the card is on screen: the
 * row washes sage, the check bursts in and the label is struck through. That
 * moment used to pass with the row silently changing, which is the opposite of
 * what a checklist is for (QA, 2026-09-27: "it needs to feel rewarding").
 *
 * `active` is the step the student just tapped: its circle pulses in the
 * accent until they finish it or pick another, so coming back to the card
 * shows what they were in the middle of.
 */
export function StepRow({
  step,
  fresh,
  active,
  onGo,
}: {
  step: Step
  fresh: boolean
  active: boolean
  onGo: () => void
}) {
  if (step.done) {
    return (
      <li className={cn('flex items-center gap-2.5 px-4 py-2.5 text-[13px]', fresh && 'ct-step-flash')}>
        <span
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full bg-accent text-accent-contrast',
            fresh && 'ct-animate-check',
          )}
        >
          <Check size={12} strokeWidth={3} aria-hidden />
        </span>
        <span className={cn('ct-strike text-subtle', fresh && 'ct-strike-in')}>{step.label}</span>
      </li>
    )
  }
  return (
    <li>
      <Link
        to={step.to}
        onClick={onGo}
        className="group flex items-center gap-2.5 px-4 py-2.5 transition-[background-color,transform] duration-150 hover:bg-surface-2/50 active:scale-[0.98] active:bg-accent-soft"
      >
        <span
          className={cn(
            'size-5 shrink-0 rounded-full border-2 transition-colors duration-150',
            active
              ? 'ct-step-active border-accent'
              : 'border-dashed border-border-strong group-hover:border-accent/70',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-fg">{step.label}</span>
          <span className="block truncate text-[11px] text-subtle">
            {active ? 'In progress: do it on this page' : step.hint}
          </span>
        </span>
        <ChevronRight
          size={15}
          aria-hidden
          className="shrink-0 text-subtle opacity-0 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
        />
      </Link>
    </li>
  )
}

/**
 * The finish line. Shown in place of the card when the last step is completed
 * while it is on screen; it leaves on its own, or on Close. Someone who
 * finished everything before this card ever loaded never sees it, since there
 * was no moment to celebrate.
 */
export function ChecklistDone({ onClose }: { onClose: () => void }) {
  return (
    <>
      <Confetti count={70} />
      <section
        role="status"
        aria-label="Getting started complete"
        className="ct-animate-pop fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 w-[300px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-accent bg-surface p-5 text-center shadow-[var(--ct-shadow)] md:bottom-5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-2.5 right-2.5 grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X size={16} aria-hidden />
        </button>
        <Mascot mood="celebrate" size="sm" className="mx-auto text-accent" />
        <p className="mt-2 font-display text-[18px] font-semibold text-fg">You&rsquo;re all set</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Every step done. Your courses, deadlines and grades are in, Today is set up your way, and Community is a tap away.
        </p>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-full rounded-full bg-accent" />
        </div>
      </section>
    </>
  )
}
