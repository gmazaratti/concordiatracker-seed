import { useState } from 'react'
import { courseColor } from '@/lib/course-color'
import { isOpen } from '@/lib/status'
import { cn } from '@/lib/cn'
import type { FamilyData } from './family-data'

const DAY = 86_400_000

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** The next four weeks, day by day: what is due on each. Read-only. */
export function FamilyCalendar({ data }: { data: FamilyData }) {
  const [now] = useState(() => Date.now())
  const course = (id: string) => data.courses.find((c) => c.id === id)
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 28 }, (_, i) => new Date(start.getTime() + i * DAY))
  const byDay = new Map<string, typeof data.assessments>()
  for (const a of data.assessments) {
    if (!a.due || !course(a.courseId)) continue
    const k = dayKey(new Date(a.due))
    const l = byDay.get(k)
    if (l) l.push(a)
    else byDay.set(k, [a])
  }
  const fmt = new Intl.DateTimeFormat('en-CA', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit' })
  const withItems = days.filter((d) => byDay.has(dayKey(d)))

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-6">
      <h1 className="font-display text-[26px] font-semibold text-fg">Calendar</h1>
      <p className="mt-1 text-[12.5px] text-subtle">The next four weeks.</p>
      {withItems.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-border-strong px-6 py-12 text-center text-[14px] text-subtle">Nothing scheduled in the next four weeks.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {withItems.map((d) => (
            <li key={d.toISOString()} className="overflow-hidden rounded-xl border border-border bg-surface">
              <p className={cn('border-b border-border px-4 py-2 text-[12.5px] font-semibold', d.getTime() === start.getTime() ? 'text-accent' : 'text-muted')}>
                {d.getTime() === start.getTime() ? 'Today' : fmt.format(d)}
              </p>
              <ul className="divide-y divide-border/60">
                {(byDay.get(dayKey(d)) ?? []).map((a) => {
                  const c = course(a.courseId)
                  return (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: c ? courseColor(c.color).hex : undefined }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate text-[14px] font-medium', isOpen(a.status) ? 'text-fg' : 'text-subtle line-through')}>{a.title}</span>
                        <span className="block text-[12px] text-subtle">
                          {c?.code} · {a.weight}%
                        </span>
                      </span>
                      <span className="shrink-0 text-[12.5px] text-muted">{time.format(new Date(a.due!))}</span>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
