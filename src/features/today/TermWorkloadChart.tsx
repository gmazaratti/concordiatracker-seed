import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import type { Assessment, Course } from '@/data/types'
import { termWorkload, workloadInsight } from '@/lib/workload'
import { cn } from '@/lib/cn'

/**
 * "Your term, week by week" — each bar is the total assessment WEIGHT due that
 * week, so the shape shows when the term actually gets hard (five 2% quizzes
 * shouldn't look like one 40% final). The current week is highlighted and the
 * heaviest week is called out below in plain language.
 */
export function TermWorkloadChart({
  assessments,
  courses,
  termStart,
  termEnd,
}: {
  assessments: Assessment[]
  courses: Course[]
  termStart: string
  termEnd: string
}) {
  const weeks = useMemo(
    () => termWorkload(assessments, termStart, termEnd),
    [assessments, termStart, termEnd],
  )
  const insight = useMemo(() => workloadInsight(weeks, courses), [weeks, courses])
  const max = useMemo(() => Math.max(1, ...weeks.map((w) => w.weight)), [weeks])

  if (weeks.length === 0 || weeks.every((w) => w.weight === 0)) return null

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-fg">Your term, week by week</h2>
        <span className="text-[10.5px] font-medium tracking-[0.14em] text-subtle uppercase">
          Workload by weight
        </span>
      </div>

      {/* Bars. Heights are relative to the busiest week. */}
      <div className="flex items-end gap-1.5 sm:gap-2" style={{ height: 104 }} aria-hidden>
        {weeks.map((w) => {
          const isPeak = insight?.week === w.week
          const pct = (w.weight / max) * 100
          return (
            <div key={w.week} className="flex h-full flex-1 flex-col justify-end">
              <div
                className={cn(
                  'w-full rounded-md transition-[height] duration-500',
                  isPeak
                    ? 'bg-accent'
                    : w.current
                      ? 'bg-accent/45'
                      : w.weight > 0
                        ? 'bg-accent/20'
                        : 'bg-surface-2',
                )}
                style={{ height: `${Math.max(w.weight > 0 ? 6 : 3, pct)}%` }}
                title={`Week ${w.week}: ${Math.round(w.weight)}% of your grade due`}
              />
            </div>
          )
        })}
      </div>

      {/* Week numbers */}
      <div className="mt-1.5 flex gap-1.5 sm:gap-2">
        {weeks.map((w) => (
          <span
            key={w.week}
            className={cn(
              'flex-1 text-center text-[10.5px] tabular-nums',
              w.current ? 'font-semibold text-accent' : insight?.week === w.week ? 'text-fg' : 'text-subtle',
            )}
          >
            {w.week}
          </span>
        ))}
      </div>

      {/* Screen-reader summary — the bars are decorative above. */}
      <p className="sr-only">
        {weeks
          .filter((w) => w.weight > 0)
          .map((w) => `Week ${w.week}: ${Math.round(w.weight)} percent of your grade due.`)
          .join(' ')}
      </p>

      {insight && (
        <p className="mt-3.5 flex items-start gap-2 border-t border-border pt-3 text-[12.5px] leading-relaxed text-muted">
          <Clock size={14} className="mt-[2px] shrink-0 text-subtle" aria-hidden />
          <span>
            {insight.text.split(':')[0]}:{' '}
            <span className="font-medium text-fg">{insight.text.split(':').slice(1).join(':').trim()}</span>
          </span>
        </p>
      )}
    </section>
  )
}
