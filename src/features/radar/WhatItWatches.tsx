import { Check, CircleDashed, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CheckState, RadarCheck } from './rules'

/**
 * The sweep, not just the hits.
 *
 * A radar that only renders what it found is indistinguishable from a radar
 * that is switched off — which is precisely the reaction the first version got:
 * one card on a mostly empty page, and no way to tell whether that meant "all
 * clear" or "nothing implemented". Listing every check with its state fixes
 * that at the root. A quiet term now reads as nine things looked at and eight
 * clear, and a check that cannot run says what it is missing rather than
 * silently passing.
 */
const STATE: Record<
  CheckState,
  { icon: typeof Check; tone: string; label: string }
> = {
  alert: { icon: TriangleAlert, tone: 'text-warning', label: 'Found something' },
  clear: { icon: Check, tone: 'text-success', label: 'Clear' },
  idle: { icon: CircleDashed, tone: 'text-subtle', label: 'Not enough data' },
}

export function WhatItWatches({
  states,
}: {
  states: { check: RadarCheck; state: CheckState; count: number }[]
}) {
  const clear = states.filter((s) => s.state === 'clear').length
  const idle = states.filter((s) => s.state === 'idle').length

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-[13px] font-semibold text-fg">What Radar checks</h2>
        <p className="text-[11.5px] text-subtle">
          {states.length} checks · {clear} clear
          {idle > 0 ? ` · ${idle} waiting on data` : ''}
        </p>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-subtle">
        These run every time you open the page, against your own account. Anything they find appears
        above.
      </p>

      <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border">
        {states.map(({ check, state, count }) => {
          const meta = STATE[state]
          const Icon = meta.icon
          return (
            <li key={check.id} className="flex items-start gap-2.5 bg-canvas px-3 py-2.5">
              <Icon size={14} className={cn('mt-0.5 shrink-0', meta.tone)} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-[12.5px] font-medium text-fg">{check.label}</span>
                  <span className={cn('text-[11px]', meta.tone)}>
                    {state === 'alert'
                      ? `${count} to look at`
                      : state === 'clear'
                        ? 'Clear'
                        : `Needs ${check.needs}`}
                  </span>
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-subtle">
                  {check.watches}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
