import type { Assessment, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { relativeDueLabel } from '@/lib/date'

/** Compact "how am I doing / what's imminent" summary. Slim label-left /
 * value-right rows so it earns its space — sits in the right rail on wide
 * screens, stacks at the top on narrow ones. */
export function GlanceStrip({
  gpa,
  itemsLeft,
  nextUp,
  nextCourse,
}: {
  gpa: number | null
  itemsLeft: number
  nextUp: Assessment | null
  nextCourse: Course | undefined
}) {
  return (
    <Card className="divide-y divide-border">
      <Row label="Current GPA" value={gpa === null ? '—' : gpa.toFixed(2)} hint="/ 4.30" />
      <Row label="Due this week" value={String(itemsLeft)} />
      <Row
        label="Next up"
        value={nextUp ? relativeDueLabel(nextUp.due) : '—'}
        sub={nextUp ? `${nextCourse?.code ?? ''} · ${nextUp.title}` : 'nothing scheduled'}
      />
    </Card>
  )
}

function Row({
  label,
  value,
  hint,
  sub,
}: {
  label: string
  value: string
  hint?: string
  sub?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-3.5 py-2.5">
      <span className="shrink-0 text-[12px] text-subtle">{label}</span>
      <span className="min-w-0 text-right">
        <span className="text-[15px] leading-tight font-semibold text-fg">
          {value}
          {hint && <span className="ml-1 text-[11px] font-normal text-subtle">{hint}</span>}
        </span>
        {sub && <span className="block truncate text-[11px] text-subtle">{sub}</span>}
      </span>
    </div>
  )
}
