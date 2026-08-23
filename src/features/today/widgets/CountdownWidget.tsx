import { CalendarClock } from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { useUiState } from '@/app/providers/ui-state'
import { Select } from '@/components/ui/Select'
import { KIND_LABEL } from '@/lib/assessment'
import { daysUntil } from '@/lib/date'
import { isOpen } from '@/lib/status'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * Days until something that matters.
 *
 * Defaults to the next exam-shaped item because that's what people actually
 * count down to, but any upcoming assessment can be pinned instead — the pick is
 * stored in ui_state so it follows you between devices.
 */
const EXAMISH = new Set(['midterm', 'final'])

export function CountdownWidget() {
  const { assessments, courseById } = useAppData()
  const { uiState, patchUiState } = useUiState()

  // A countdown to an unknown date is not a countdown, so undated work is
  // excluded rather than shown at zero.
  const upcoming = assessments
    .filter((a): a is typeof a & { due: string } => isOpen(a.status) && !!a.due && daysUntil(a.due) >= 0)
    .sort((a, b) => +new Date(a.due) - +new Date(b.due))

  const pinned = upcoming.find((a) => a.id === uiState.countdownId)
  // Fall back to the next exam, then to the next anything — a countdown with
  // nothing pinned should still be useful on day one.
  const target = pinned ?? upcoming.find((a) => EXAMISH.has(a.kind)) ?? upcoming[0]

  if (!target) {
    return (
      <WidgetCard title="Countdown" icon={CalendarClock}>
        <WidgetEmpty>Nothing scheduled ahead: enjoy it.</WidgetEmpty>
      </WidgetCard>
    )
  }

  const days = daysUntil(target.due)
  const course = courseById(target.courseId)

  return (
    <WidgetCard
      title="Countdown"
      icon={CalendarClock}
      action={
        upcoming.length > 1 ? (
          <Select
            ariaLabel="What to count down to"
            value={target.id}
            onChange={(id) => patchUiState({ countdownId: id })}
            size="sm"
            tone="control"
            className="w-[112px]"
            options={upcoming.slice(0, 12).map((a) => ({ value: a.id, label: a.title }))}
          />
        ) : undefined
      }
    >
      <div className="px-3.5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[30px] leading-none font-semibold text-fg tabular-nums">
            {days}
          </span>
          <span className="text-[12.5px] text-muted">
            {days === 0 ? 'today' : days === 1 ? 'day away' : 'days away'}
          </span>
        </div>
        <p className="mt-1.5 truncate text-[12.5px] font-medium text-fg">{target.title}</p>
        <p className="text-[11.5px] text-subtle">
          {course?.code ?? 'Course'} · {KIND_LABEL[target.kind]}
        </p>
      </div>
    </WidgetCard>
  )
}
