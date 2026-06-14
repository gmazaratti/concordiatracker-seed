import type { Assessment, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { relativeDueLabel, termProgress } from '@/lib/date'
import { cn } from '@/lib/cn'

export interface GlanceData {
  term: { name: string; start: string; end: string }
  gpa: number | null
  overdue: number
  itemsLeft: number
  nextUp: Assessment | null
  nextCourse: Course | undefined
  doneToday: number
  courseCount: number
  credits: number
}

/** The right-rail "at a glance" panel: two progress bars (term + today's work)
 * over a compact stat list. Every number is derived from data already on the
 * page — no new features, just composed to fill the rail honestly. */
export function GlanceStrip(data: GlanceData) {
  const { week, totalWeeks, percent } = termProgress(data.term.start, data.term.end)
  const totalToday = data.doneToday + data.itemsLeft
  const todayPercent = totalToday === 0 ? 100 : (data.doneToday / totalToday) * 100

  return (
    <Card className="overflow-hidden">
      <p className="border-b border-border px-3.5 py-2.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        At a glance
      </p>

      <div className="space-y-3 border-b border-border px-3.5 py-3">
        <Progress
          label={data.term.name}
          value={`Week ${week} of ${totalWeeks}`}
          percent={percent}
        />
        <Progress
          label="Today's progress"
          value={`${data.doneToday} done · ${data.itemsLeft} to go`}
          percent={todayPercent}
          accent
        />
      </div>

      <div className="divide-y divide-border">
        <Row label="Current GPA" value={data.gpa === null ? '—' : data.gpa.toFixed(2)} hint="/ 4.30" />
        <Row label="Overdue" value={String(data.overdue)} danger={data.overdue > 0} />
        <Row label="Due this week" value={String(data.itemsLeft)} />
        <Row
          label="Next up"
          value={data.nextUp ? relativeDueLabel(data.nextUp.due) : '—'}
          sub={
            data.nextUp
              ? `${data.nextCourse?.code ?? ''} · ${data.nextUp.title}`
              : 'nothing scheduled'
          }
        />
        <Row
          label="This term"
          value={`${data.courseCount} courses`}
          sub={`${data.credits} credits`}
        />
      </div>
    </Card>
  )
}

function Progress({
  label,
  value,
  percent,
  accent = false,
}: {
  label: string
  value: string
  percent: number
  accent?: boolean
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-subtle">{label}</span>
        <span className="text-[12px] font-medium text-fg">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-200',
            accent ? 'bg-accent' : 'bg-border-strong',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  hint,
  sub,
  danger = false,
}: {
  label: string
  value: string
  hint?: string
  sub?: string
  danger?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
      <span className="shrink-0 text-[12px] text-subtle">{label}</span>
      <span className="min-w-0 text-right">
        <span
          className={cn(
            'text-[15px] leading-tight font-semibold',
            danger ? 'text-danger' : 'text-fg',
          )}
        >
          {value}
          {hint && <span className="ml-1 text-[11px] font-normal text-subtle">{hint}</span>}
        </span>
        {sub && <span className="block truncate text-[11px] text-subtle">{sub}</span>}
      </span>
    </div>
  )
}
