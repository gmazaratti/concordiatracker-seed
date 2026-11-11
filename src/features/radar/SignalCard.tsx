import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, ChevronDown } from 'lucide-react'
import { parseDay } from '@/features/calendar/calendar'
import { cn } from '@/lib/cn'
import { formatMonthDay } from '@/lib/date'
import { SEVERITY, TOPIC, tint } from './radar-look'
import type { Signal } from './rules'

/**
 * One thing Radar found. The first (worst) one is drawn large; the rest sit in
 * a grid. Every card can show where its claim comes from: a warning you cannot
 * check is a warning you learn to ignore.
 */
export function SignalCard({ signal, lead, delay = 0 }: { signal: Signal; lead?: boolean; delay?: number }) {
  const [why, setWhy] = useState(false)
  const sev = SEVERITY[signal.severity]
  const topic = TOPIC[signal.topic]
  const Icon = topic.icon
  return (
    <article
      className={cn(
        'ct-res-in relative flex flex-col overflow-hidden rounded-3xl border bg-surface',
        sev.ring,
        lead ? 'p-5 sm:p-7' : 'p-5',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* A soft glow in the topic's colour: enough to tell cards apart, not
          enough to turn the page into an alarm. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full blur-3xl"
        style={{ backgroundColor: tint(topic.hex, lead ? 0.28 : 0.18) }}
      />
      <div className="relative flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: topic.hex }}>
          <Icon size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold">
            <span className={cn('inline-flex items-center gap-1.5', sev.text)}>
              <span className={cn('size-2 rounded-full', sev.bg)} aria-hidden />
              {sev.label}
            </span>
            <span className="font-medium text-subtle">{topic.label}</span>
          </p>
        </div>
        {signal.by && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-fg">
            <CalendarClock size={12} className="text-subtle" aria-hidden />
            {formatMonthDay(parseDay(signal.by))}
          </span>
        )}
      </div>

      <h4
        className={cn(
          'relative mt-4 font-display leading-tight font-semibold text-balance text-fg',
          lead ? 'text-[24px] sm:text-[28px]' : 'text-[18px]',
        )}
      >
        {signal.title}
      </h4>
      <p className={cn('relative mt-2 leading-relaxed text-muted', lead ? 'max-w-2xl text-[15px]' : 'text-[13.5px]')}>
        {signal.detail}
      </p>

      <div className="relative mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-4">
        {signal.action && (
          <Link
            to={signal.action.to}
            className={cn(
              'inline-flex items-center gap-1.5 text-[13.5px] font-semibold transition-colors duration-150',
              lead
                ? 'rounded-full bg-accent px-4 py-2 text-accent-contrast hover:bg-accent-hover'
                : 'text-accent hover:underline',
            )}
          >
            {signal.action.label}
            <ArrowRight size={14} aria-hidden />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setWhy((w) => !w)}
          aria-expanded={why}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-subtle transition-colors duration-150 hover:text-fg"
        >
          Why am I seeing this?
          <ChevronDown size={13} className={cn('transition-transform duration-200', why && 'rotate-180')} aria-hidden />
        </button>
      </div>
      {why && (
        <p className="relative mt-3 rounded-2xl bg-canvas/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
          {signal.basis}
        </p>
      )}
    </article>
  )
}
