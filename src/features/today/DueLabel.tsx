import { daysUntil, relativeDueLabel } from '@/lib/date'
import { cn } from '@/lib/cn'
import { DUE_COLUMN } from './due-column'

/**
 * The due date on every Today row: an assessment, a Moodle deadline or a task.
 *
 * ONE COMPONENT, so the column, the size, the weight and the colour cannot
 * differ between row kinds. They did: the Moodle/task row had its own span at a
 * lighter weight and size, and without a ⋯ beside it the column sat further
 * right than on the assessment rows.
 *
 * Colour leans on urgency only (red overdue, amber today, otherwise plain);
 * something already done is muted rather than red.
 */
export function DueLabel({
  due,
  done = false,
  hint = null,
}: {
  due: string | null
  done?: boolean
  /** Context for an undated item (an undated final's exam period). Rendered
   *  muted, italic and regular weight so it can never be read as a date. */
  hint?: string | null
}) {
  if (!due && hint && !done) {
    return (
      <span
        className={cn(DUE_COLUMN, 'pt-px text-[12px] font-normal text-subtle italic')}
        title="The Examinations Office has not scheduled this yet"
      >
        {hint}
      </span>
    )
  }
  return (
    <span className={cn(DUE_COLUMN, 'pt-px text-[13px] font-semibold', tone(due, done))}>
      {relativeDueLabel(due)}
    </span>
  )
}

function tone(due: string | null, done: boolean): string {
  if (done) return 'text-muted'
  // No date, no urgency colour: the row still says "Date not set", quietly.
  if (!due) return 'text-subtle'
  const days = daysUntil(due)
  if (days < 0) return 'text-danger'
  if (days === 0) return 'text-warning'
  return 'text-fg'
}
