import { Check, Lock } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * One step of a sequence, with the state visible at a glance.
 *
 * The record panel was four equal-weight sections and you could not tell where
 * to look. Steps solve that by having exactly one obvious place to be: done
 * steps recede, the current one is the only thing with contrast, and a locked
 * step says what would unlock it instead of showing an empty result.
 *
 * The connector line is drawn by the marker column rather than a wrapper, so a
 * step's height is free to be whatever its content needs.
 */
export type StepState = 'done' | 'active' | 'locked'

export function Step({
  n,
  title,
  sub,
  state,
  lockedReason,
  last = false,
  children,
}: {
  n: number
  title: string
  sub?: string
  state: StepState
  /** Shown in place of the content when locked. One line, and actionable. */
  lockedReason?: string
  last?: boolean
  children?: React.ReactNode
}) {
  return (
    <section className="flex gap-3 sm:gap-4">
      {/* Marker + connector */}
      <div className="flex shrink-0 flex-col items-center">
        <span
          className={cn(
            'grid size-7 place-items-center rounded-full border text-[12px] font-semibold transition-colors duration-200',
            state === 'done' && 'border-accent bg-accent text-accent-contrast',
            state === 'active' && 'border-accent bg-accent-soft text-accent',
            state === 'locked' && 'border-border bg-surface text-subtle',
          )}
        >
          {state === 'done' ? (
            <Check size={14} aria-hidden />
          ) : state === 'locked' ? (
            <Lock size={12} aria-hidden />
          ) : (
            n
          )}
        </span>
        {!last && (
          <span
            className={cn(
              'mt-1 w-px flex-1 transition-colors duration-200',
              state === 'done' ? 'bg-accent/40' : 'bg-border',
            )}
          />
        )}
      </div>

      <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-7')}>
        <h2
          className={cn(
            'font-display text-[16px] leading-tight font-semibold',
            state === 'locked' ? 'text-subtle' : 'text-fg',
          )}
        >
          {title}
        </h2>
        {sub && state !== 'locked' && (
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-subtle">{sub}</p>
        )}

        {state === 'locked' ? (
          <p className="mt-2 rounded-lg border border-dashed border-border px-3.5 py-3 text-[12.5px] text-subtle">
            {lockedReason}
          </p>
        ) : (
          <div className="mt-3">{children}</div>
        )}
      </div>
    </section>
  )
}
