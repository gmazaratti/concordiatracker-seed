import { Flame } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { WidgetCard } from './WidgetCard'

/**
 * Consecutive days you've finished something.
 *
 * Built on `visitDays`, which ui_state already records for the survey gate, so
 * there's no new tracking. Deliberately FORGIVING: the streak survives a single
 * missed day. A student who gets sick on a Tuesday shouldn't be told they've
 * lost three weeks of progress — a streak that punishes real life stops being
 * motivating and starts being a reason to close the app.
 */
function streakFrom(days: string[] | undefined, today: Date): { current: number; best: number } {
  if (!days?.length) return { current: 0, best: 0 }
  const set = new Set(days)
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  let current = 0
  let misses = 0
  const cursor = new Date(today)
  // Walk back a term's worth of days; one gap is forgiven, two ends it.
  for (let i = 0; i < 120; i++) {
    if (set.has(ymd(cursor))) current++
    else if (i > 0 && ++misses > 1) break
    cursor.setDate(cursor.getDate() - 1)
  }
  return { current, best: Math.max(current, set.size) }
}

export function StreakWidget() {
  const { uiState } = useUiState()
  const { current } = streakFrom(uiState.visitDays, new Date())

  return (
    <WidgetCard title="Streak" icon={Flame}>
      <div className="px-3.5 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[30px] leading-none font-semibold text-fg tabular-nums">
            {current}
          </span>
          <span className="text-[12.5px] text-muted">{current === 1 ? 'day' : 'days'}</span>
        </div>
        <p className="mt-1 text-[11.5px] text-subtle">
          {current === 0
            ? 'Open the app tomorrow to start one.'
            : 'One missed day is forgiven: keep going.'}
        </p>
      </div>
    </WidgetCard>
  )
}
