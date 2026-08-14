import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, Timer } from 'lucide-react'
import { cn } from '@/lib/cn'
import { WidgetCard } from './WidgetCard'

/**
 * A focus timer. 25 on, 5 off — the pomodoro default, because arguing about the
 * numbers is how people avoid starting.
 *
 * Deliberately session-only: nothing is logged, counted, or streaked. A timer
 * that scores you turns a break into a failure, and this screen already carries
 * enough obligation.
 *
 * The remaining time is derived from a wall-clock DEADLINE, not decremented per
 * tick, so a backgrounded tab — where browsers throttle timers hard — still
 * shows the right number when you come back. The clock is read in the interval
 * and in event handlers only, never during render (react-hooks/purity).
 */
const FOCUS_MS = 25 * 60_000
const BREAK_MS = 5 * 60_000

export function StudyTimerWidget() {
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [endsAt, setEndsAt] = useState<number | null>(null)
  const [left, setLeft] = useState(FOCUS_MS)

  const total = mode === 'focus' ? FOCUS_MS : BREAK_MS
  const running = endsAt !== null

  useEffect(() => {
    if (endsAt === null) return
    const id = window.setInterval(() => {
      const remaining = Math.max(0, endsAt - Date.now())
      setLeft(remaining)
      if (remaining === 0) {
        // Roll into the other half of the cycle, stopped, so finishing a focus
        // block doesn't silently start a break you didn't ask for.
        const next = mode === 'focus' ? 'break' : 'focus'
        setMode(next)
        setEndsAt(null)
        setLeft(next === 'focus' ? FOCUS_MS : BREAK_MS)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [endsAt, mode])

  const mins = Math.floor(left / 60_000)
  const secs = Math.floor((left % 60_000) / 1000)
  const pct = total > 0 ? ((total - left) / total) * 100 : 0

  return (
    <WidgetCard title={mode === 'focus' ? 'Focus' : 'Break'} icon={Timer}>
      <div className="px-3.5 py-3">
        <div className="flex items-center gap-3">
          <span className="font-display text-[28px] leading-none font-semibold text-fg tabular-nums">
            {mins}:{String(secs).padStart(2, '0')}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                // Reading the clock in a handler is fine; during render it isn't.
                if (running) setEndsAt(null)
                else setEndsAt(Date.now() + left)
              }}
              aria-label={running ? 'Pause timer' : 'Start timer'}
              className="grid size-8 place-items-center rounded-lg bg-accent text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              {running ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={() => {
                setEndsAt(null)
                setLeft(total)
              }}
              aria-label="Reset timer"
              className="grid size-8 place-items-center rounded-lg text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <RotateCcw size={14} aria-hidden />
            </button>
          </div>
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn('h-full rounded-full', mode === 'focus' ? 'bg-accent' : 'bg-success')}
            style={{ width: `${pct}%`, transition: 'width 250ms linear' }}
          />
        </div>
      </div>
    </WidgetCard>
  )
}
