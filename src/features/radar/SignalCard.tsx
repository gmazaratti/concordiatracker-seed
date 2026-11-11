import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { PHOTOS } from '@/data/resource-photos'
import { parseDay } from '@/features/calendar/calendar'
import { cn } from '@/lib/cn'
import { formatMonthDay } from '@/lib/date'
import { SEVERITY, TOPIC, daysUntil, pretty, tint } from './radar-look'
import type { Signal } from './rules'

/**
 * Three ways to show a finding, so the page is not one card repeated: the most
 * pressing one is a photograph in its topic's colour, the other urgent ones
 * are cards with the date as their landmark, and the rest are a compact list.
 * Every one can show where its claim comes from: a warning you cannot check
 * is a warning you learn to ignore.
 */
function when(by: string, now: Date): string {
  const d = daysUntil(by, now)
  // A crunch is dated by its week's Monday, so a few days back still means "this week".
  if (d < 0) return d >= -6 ? 'This week' : 'Passed'
  return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`
}

/** The date a window shuts, drawn like a calendar page. */
function DateTile({ by, now, light }: { by: string; now: Date; light?: boolean }) {
  const [month, day] = formatMonthDay(parseDay(by)).split(' ')
  return (
    <span
      className={cn(
        'flex w-[68px] shrink-0 flex-col items-center overflow-hidden rounded-2xl text-center',
        light ? 'bg-white text-black' : 'border border-border bg-canvas text-fg',
      )}
    >
      <span className={cn('w-full py-0.5 text-[10.5px] font-bold tracking-[0.12em] uppercase', light ? 'bg-black/85 text-white' : 'bg-surface-2 text-muted')}>
        {month}
      </span>
      <span className="font-display text-[26px] leading-[1.15] font-bold tabular-nums">{day}</span>
      <span className={cn('pb-1 text-[10.5px] font-semibold', light ? 'text-black/60' : 'text-subtle')}>{when(by, now)}</span>
    </span>
  )
}

function Why({ open, onToggle, light }: { open: boolean; onToggle: () => void; light?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'inline-flex items-center gap-1 text-[12.5px] font-medium transition-colors duration-150',
        light ? 'text-white/75 hover:text-white' : 'text-subtle hover:text-fg',
      )}
    >
      Why am I seeing this?
      <ChevronDown size={13} className={cn('transition-transform duration-200', open && 'rotate-180')} aria-hidden />
    </button>
  )
}

/** The most pressing finding: a photograph washed in its topic's colour. */
export function LeadSignal({ signal, now }: { signal: Signal; now: Date }) {
  const [why, setWhy] = useState(false)
  const sev = SEVERITY[signal.severity]
  const topic = TOPIC[signal.topic]
  return (
    <article
      className="ct-res-in relative isolate overflow-hidden rounded-3xl p-5 text-white sm:p-7"
      style={{ backgroundColor: topic.hex }}
    >
      <img
        src={PHOTOS[topic.photo].src}
        alt=""
        className="absolute inset-0 -z-20 size-full object-cover opacity-75 mix-blend-luminosity grayscale"
      />
      <span aria-hidden className="absolute inset-0 -z-10 mix-blend-multiply" style={{ backgroundColor: topic.hex, opacity: 0.6 }} />
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/50 to-black/10" />
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
            <span className="rounded-full bg-white px-2.5 py-1 text-black">Most pressing</span>
            <span className="rounded-full bg-white/20 px-2.5 py-1 backdrop-blur-md">
              {sev.label} · {topic.label}
            </span>
          </p>
          <h4 className="mt-4 max-w-2xl font-display text-[26px] leading-[1.1] font-bold text-balance sm:text-[34px]">
            {pretty(signal.title)}
          </h4>
          <p className="mt-2.5 max-w-2xl text-[15px] leading-relaxed text-white/85">{pretty(signal.detail)}</p>
        </div>
        {signal.by && <DateTile by={signal.by} now={now} light />}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        {signal.action && (
          <Link
            to={signal.action.to}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-black transition-transform duration-200 hover:translate-x-0.5"
          >
            {signal.action.label}
            <ArrowRight size={14} aria-hidden />
          </Link>
        )}
        <Why open={why} onToggle={() => setWhy((w) => !w)} light />
      </div>
      {why && (
        <p className="mt-3 max-w-2xl rounded-2xl bg-black/45 px-4 py-3 text-[13px] leading-relaxed text-white/85 backdrop-blur-md">
          {pretty(signal.basis)}
        </p>
      )}
    </article>
  )
}

/** An urgent finding: the date (or the topic) on the left, the point on the right. */
export function SignalCard({ signal, now, delay = 0 }: { signal: Signal; now: Date; delay?: number }) {
  const [why, setWhy] = useState(false)
  const sev = SEVERITY[signal.severity]
  const topic = TOPIC[signal.topic]
  const Icon = topic.icon
  return (
    <article
      className={cn('ct-res-in flex gap-4 rounded-3xl border bg-surface p-4 sm:p-5', sev.ring)}
      style={{ animationDelay: `${delay}ms` }}
    >
      {signal.by ? (
        <DateTile by={signal.by} now={now} />
      ) : (
        <span
          className="grid size-[68px] shrink-0 place-items-center rounded-2xl"
          style={{ backgroundColor: tint(topic.hex, 0.16), color: topic.hex }}
        >
          <Icon size={28} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] font-semibold">
          <span className={cn('inline-flex items-center gap-1.5', sev.text)}>
            <span className={cn('size-2 rounded-full', sev.bg)} aria-hidden />
            {sev.label}
          </span>
          <span className="inline-flex items-center gap-1 font-medium" style={{ color: topic.hex }}>
            {topic.label}
          </span>
        </p>
        <h4 className="mt-1 font-display text-[18px] leading-snug font-semibold text-balance text-fg">{pretty(signal.title)}</h4>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{pretty(signal.detail)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {signal.action && (
            <Link to={signal.action.to} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
              {signal.action.label}
              <ArrowRight size={13} aria-hidden />
            </Link>
          )}
          <Why open={why} onToggle={() => setWhy((w) => !w)} />
        </div>
        {why && <p className="mt-3 rounded-2xl bg-canvas/70 px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">{pretty(signal.basis)}</p>}
      </div>
    </article>
  )
}

/** A lower-priority finding: one line, opened for the detail. */
export function SignalRow({ signal, now }: { signal: Signal; now: Date }) {
  const [open, setOpen] = useState(false)
  const topic = TOPIC[signal.topic]
  const Icon = topic.icon
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-surface-2/50 sm:px-5"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: topic.hex }}>
          <Icon size={18} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-snug font-semibold text-fg">{pretty(signal.title)}</span>
          <span className="block truncate text-[12.5px] text-muted">
            {topic.label}
            {signal.by ? ` · ${formatMonthDay(parseDay(signal.by))}, ${when(signal.by, now).toLowerCase()}` : ''}
          </span>
        </span>
        <ChevronDown size={17} className={cn('shrink-0 text-subtle transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div className="px-4 pb-4 pl-[4.375rem] sm:px-5 sm:pl-[4.625rem]">
          <p className="text-[13.5px] leading-relaxed text-muted">{pretty(signal.detail)}</p>
          <p className="mt-2 rounded-2xl bg-canvas/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-subtle">{pretty(signal.basis)}</p>
          {signal.action && (
            <Link to={signal.action.to} className="mt-2.5 inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
              {signal.action.label}
              <ArrowRight size={13} aria-hidden />
            </Link>
          )}
        </div>
      )}
    </li>
  )
}
