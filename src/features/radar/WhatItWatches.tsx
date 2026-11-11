import { Check, CircleDashed, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TOPIC, tint } from './radar-look'
import type { CheckState, RadarCheck, Signal } from './rules'

/**
 * The sweep, not just the hits.
 *
 * A radar that only renders what it found is indistinguishable from a radar
 * that is switched off. Listing every check with its state fixes that: a quiet
 * term reads as nine things looked at and eight clear, and a check that cannot
 * run says what it is missing rather than silently passing.
 *
 * Grouped by topic, each in its own colour, so the list is four short columns
 * of tiles rather than one long table.
 */
const STATE: Record<CheckState, { icon: typeof Check; tone: string }> = {
  alert: { icon: TriangleAlert, tone: 'text-warning' },
  clear: { icon: Check, tone: 'text-success' },
  idle: { icon: CircleDashed, tone: 'text-subtle' },
}

const ORDER: Signal['topic'][] = ['load', 'deadlines', 'grades', 'coverage']

export function WhatItWatches({ states }: { states: { check: RadarCheck; state: CheckState; count: number }[] }) {
  return (
    <section aria-labelledby="radar-checks">
      <h3 id="radar-checks" className="font-display text-[22px] font-semibold tracking-tight text-fg">
        Everything it checks
      </h3>
      <p className="mt-0.5 text-[13px] text-muted">
        All {states.length} run every time, found something or not. A check that cannot look says what it needs.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {ORDER.map((id, gi) => {
          const topic = TOPIC[id]
          const rows = states.filter((s) => s.check.topic === id)
          if (rows.length === 0) return null
          const Icon = topic.icon
          return (
            <div
              key={id}
              className="ct-res-in overflow-hidden rounded-3xl border border-border bg-surface"
              style={{ animationDelay: `${gi * 60}ms` }}
            >
              <div className="flex items-center gap-3 px-4 py-3.5" style={{ backgroundColor: tint(topic.hex, 0.14) }}>
                <span className="grid size-9 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: topic.hex }}>
                  <Icon size={17} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-fg">{topic.label}</p>
                  <p className="truncate text-[12.5px] text-muted">{topic.blurb}</p>
                </div>
              </div>
              <ul className="divide-y divide-border/60">
                {rows.map(({ check, state, count }) => {
                  const meta = STATE[state]
                  const StateIcon = meta.icon
                  return (
                    <li key={check.id} className="flex items-start gap-3 px-4 py-3">
                      <StateIcon size={16} className={cn('mt-0.5 shrink-0', meta.tone)} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className="text-[14px] font-semibold text-fg">{check.label}</span>
                          <span className={cn('text-[12px] font-medium', meta.tone)}>
                            {state === 'alert' ? `${count} to look at` : state === 'clear' ? 'Clear' : `Needs ${check.needs}`}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{check.watches}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
