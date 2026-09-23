import { useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import { AreaChart, Sparkline } from '@/features/admin/AreaChart'
import { Panel } from '@/features/admin/admin-ui'
import { cn } from '@/lib/cn'
import { sum, type DaySeries, type SeriesKey } from './use-org-series'

const people = (n: number) => n.toLocaleString()

/**
 * One number with its trend underneath, the admin overview's card shape.
 *
 * The change is against the PREVIOUS period of the same length and is printed
 * in text colours, not green/red: those are reserved for status, and "fewer
 * likes than last week" is not an error.
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  change,
  points,
}: {
  icon: LucideIcon
  label: string
  value: number
  sub: string
  change: number | null
  points: { day: string; value: number }[]
}) {
  const Arrow = change == null || change === 0 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-3.5">
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        <Icon size={14} className="text-accent" aria-hidden />
        {label}
      </div>
      <p className="mt-1 font-display text-[24px] leading-none font-semibold text-fg tabular-nums">{people(value)}</p>
      <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-subtle">
        <Arrow size={12} aria-hidden />
        {change == null ? sub : `${change > 0 ? '+' : ''}${change}% · ${sub}`}
      </p>
      <div className="mt-2">
        <Sparkline points={points} height={34} />
      </div>
    </div>
  )
}

const METRICS: { key: SeriesKey; label: string; one: string; many: string }[] = [
  { key: 'newFollowers', label: 'New followers', one: 'new follower', many: 'new followers' },
  { key: 'likes', label: 'Likes', one: 'like', many: 'likes' },
  { key: 'comments', label: 'Comments', one: 'comment', many: 'comments' },
  { key: 'posts', label: 'Posts', one: 'post', many: 'posts' },
  { key: 'events', label: 'Events', one: 'event', many: 'events' },
]

/** The big chart: one series at a time, picked from chips — never two
 *  measures of different scale on one axis. */
export function GrowthPanel({ rows, days }: { rows: DaySeries[] | null; days: number }) {
  const [key, setKey] = useState<SeriesKey>('newFollowers')
  const m = METRICS.find((x) => x.key === key)!
  const points = (rows ?? []).map((r) => ({ day: r.day, value: r[key] }))
  const total = sum(rows, key)
  return (
    <Panel
      title="Growth"
      sub={`${people(total)} ${total === 1 ? m.one : m.many} in the last ${days} days`}
    >
      <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 [scrollbar-width:none]">
        {METRICS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setKey(x.key)}
            aria-pressed={key === x.key}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors duration-150',
              key === x.key ? 'border-accent bg-accent-soft text-accent' : 'border-border text-muted hover:text-fg',
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2 pb-3">
        {rows === null ? (
          <div className="h-[220px] animate-pulse rounded-lg bg-surface-2/50" />
        ) : (
          <AreaChart points={points} label={m.label} format={(n) => `${people(n)} ${n === 1 ? m.one : m.many}`} height={220} />
        )}
      </div>
    </Panel>
  )
}
