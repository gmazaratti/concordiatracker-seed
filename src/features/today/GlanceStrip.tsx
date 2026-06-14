import type { Assessment, Course } from '@/data/types'
import { Card } from '@/components/ui/Card'
import { relativeDueLabel } from '@/lib/date'

/** Compact one-row "how am I doing / what's imminent" summary. Deliberately a
 * thin strip, not a stack of hero cards. */
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
    <Card className="grid grid-cols-3 divide-x divide-border">
      <Stat label="Current GPA" value={gpa === null ? '—' : gpa.toFixed(2)} hint="4.30 scale" />
      <Stat
        label="Due this week"
        value={String(itemsLeft)}
        hint={itemsLeft === 0 ? 'all clear' : itemsLeft === 1 ? 'item left' : 'items left'}
      />
      <Stat
        label="Next up"
        value={nextUp ? relativeDueLabel(nextUp.due) : '—'}
        hint={nextUp ? `${nextCourse?.code ?? ''} · ${nextUp.title}` : 'nothing scheduled'}
      />
    </Card>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="min-w-0 px-4 py-3.5">
      <p className="text-[11px] font-medium tracking-wide text-subtle uppercase">
        {label}
      </p>
      <p className="mt-1 truncate text-[18px] leading-tight font-semibold text-fg">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-subtle">{hint}</p>
    </div>
  )
}
