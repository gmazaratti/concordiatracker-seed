import { CircleDashed } from 'lucide-react'
import type { Course } from '@/data/types'
import { courseColor } from '@/lib/course-color'
import { daysUntil } from '@/lib/date'
import { isFinished, isOpen } from '@/lib/status'
import { cn } from '@/lib/cn'
import { ACADEMIC_META, type CalendarItem } from './calendar'

/** Is an assessment still open AND past due → the red "overdue" signal. */
function isOverdue(item: CalendarItem): boolean {
  return (
    item.kind === 'assessment' &&
    isOpen(item.assessment.status) &&
    !!item.assessment.due &&
    daysUntil(item.assessment.due) < 0
  )
}

/** A compact one-line event marker — the calm chip shared by Month + Week cells.
 * Color is reserved: a course identity dot for assignments, an info-blue icon for
 * the Concordia layer, a neutral dot for personal tasks. Saturated red is only
 * for an overdue assignment. */
export function EventPill({
  item,
  course,
  className,
  dotOnly = false,
}: {
  item: CalendarItem
  course?: Course
  className?: string
  /** Narrow month cells: the marker only, with the title for screen readers. */
  dotOnly?: boolean
}) {
  const overdue = isOverdue(item)

  let dot: React.ReactNode
  let label: string
  let done = false
  /** A course's colour, for the chip's wash and edge. */
  let hexOf: string | null = null

  if (item.kind === 'assessment') {
    const hex = course ? courseColor(course.color).hex : '#888'
    hexOf = hex
    done = isFinished(item.assessment.status)
    dot = <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
    label = item.assessment.title
  } else if (item.kind === 'task') {
    done = item.task.done
    dot = <span className="size-1.5 shrink-0 rounded-full bg-subtle" aria-hidden />
    label = item.task.title
  } else if (item.kind === 'undated') {
    // Deliberately reads as a COUNT, not an exam: we do not know when these are,
    // only that they land somewhere in this fortnight.
    dot = <CircleDashed size={11} className="shrink-0 text-warning" aria-hidden />
    label = `${item.items.length} with no date yet`
  } else {
    const Icon = ACADEMIC_META[item.event.kind].icon
    dot = <Icon size={11} className="shrink-0 text-info" aria-hidden />
    label = item.event.title
  }

  /*
    A MONTH CELL ON A PHONE IS ~46px WIDE. A label truncated into it reads
    "L…", "Q…", "A…" — one letter and an ellipsis, which tells you nothing at
    all and still costs the row its height. The dot alone says the one thing
    that fits: something is on this day, and roughly what kind. The title is
    a tap away in the day sheet, and stays available to assistive tech here.
  */
  if (dotOnly) {
    return (
      <span className="inline-flex" title={label}>
        {overdue ? (
          <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />
        ) : (
          dot
        )}
        <span className="sr-only">{label}</span>
      </span>
    )
  }

  // A filled chip rather than a dot and grey text: an assignment wears its
  // course's colour (wash plus a solid edge), the university's dates are blue,
  // undated work is amber, and red is still only for overdue.
  const tone = overdue
    ? 'bg-danger/15 text-danger'
    : item.kind === 'academic'
      ? 'bg-info/[0.13] text-info'
      : item.kind === 'undated'
        ? 'bg-warning/[0.14] text-warning'
        : item.kind === 'task'
          ? 'bg-surface-2 text-fg/85'
          : 'text-fg'
  const wash = !overdue && hexOf ? { backgroundColor: `${hexOf}2b`, boxShadow: `inset 3px 0 0 ${hexOf}` } : undefined
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-md py-[3px] pr-1.5 text-left text-[11.5px] leading-tight font-medium',
        hexOf && !overdue ? 'pl-2' : 'pl-1.5',
        tone,
        overdue && 'shadow-[inset_3px_0_0_var(--ct-danger)] pl-2',
        done && 'line-through opacity-50',
        className,
      )}
      style={wash}
    >
      {!(hexOf && !overdue) && !overdue && dot}
      <span className="truncate">{label}</span>
    </span>
  )
}
