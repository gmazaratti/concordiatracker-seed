import { cn } from '@/lib/cn'
import type { PushAnalytics } from './push-analytics'

/** Delivered per day as a pale bar, with the opened share filled in solid. */
export function DailyBars({ daily }: { daily: PushAnalytics['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.delivered))
  return (
    <div>
      <div className="flex h-36 items-end gap-[3px]">
        {daily.map((d) => (
          <div
            key={d.day}
            className="relative flex-1 rounded-t-sm bg-accent/20"
            style={{ height: d.delivered ? `${(d.delivered / max) * 100}%` : '2px' }}
            title={`${d.day}: ${d.delivered} delivered, ${d.opened} opened`}
          >
            <div
              className="absolute inset-x-0 bottom-0 rounded-t-sm bg-accent"
              style={{ height: d.delivered ? `${(d.opened / d.delivered) * 100}%` : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-2 text-[11px] text-subtle">
        <span>{daily[0]?.day}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-accent/20" aria-hidden /> delivered
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm bg-accent" aria-hidden /> opened
          </span>
        </span>
        <span>{daily[daily.length - 1]?.day}</span>
      </div>
    </div>
  )
}

/** Open rate for each hour of the day a push went out. */
export function HourBars({ hours }: { hours: PushAnalytics['by_hour'] }) {
  const byHour = new Map(hours.map((h) => [h.hour, h]))
  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]">
        {Array.from({ length: 24 }, (_, h) => {
          const x = byHour.get(h)
          const r = x && x.delivered ? x.opened / x.delivered : 0
          return (
            <div
              key={h}
              className={cn('flex-1 rounded-t-sm', x?.delivered ? 'bg-accent' : 'bg-surface-2')}
              style={{ height: x?.delivered ? `${Math.max(4, r * 100)}%` : '4%' }}
              title={x ? `${h}:00 · ${x.opened} of ${x.delivered} opened` : `${h}:00 · nothing sent`}
            />
          )
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
        <span>midnight</span>
        <span>noon</span>
        <span>11 pm</span>
      </div>
    </div>
  )
}
