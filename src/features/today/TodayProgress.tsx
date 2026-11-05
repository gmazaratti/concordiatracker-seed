import { Moon } from 'lucide-react'
import { useT } from '@/i18n/i18n'
import type { Key } from '@/i18n/en'

/**
 * The reward for ticking something off: a bar that fills and a short line that
 * changes as it does. Shown only once something is done today, so a fresh
 * morning stays calm. Restrained on purpose (one bar, one line), with the
 * width transition the only motion, which reduced motion flattens.
 */
export function TodayProgress({ done, left }: { done: number; left: number }) {
  const t = useT()
  if (done === 0) return null
  const total = done + left
  const pct = total === 0 ? 100 : Math.round((done / total) * 100)
  const cheer: Key = left === 0 ? 'today.cheerAll' : done >= 5 ? 'today.cheerMany' : done >= 3 ? 'today.cheerRoll' : done === 1 ? 'today.cheerOne' : 'today.cheerStart'
  return (
    <div className="border-b border-border px-4 py-2.5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
        <span className="font-semibold text-fg">{t(cheer)}</span>
        <span className="tabular-nums text-subtle">{t('today.progress', { done, total })}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div
          className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** "2 pushed to tomorrow · Bring back": the one way to undo a snooze later. */
export function SnoozedLine({ count, onBringBack }: { count: number; onBringBack: () => void }) {
  const t = useT()
  if (count === 0) return null
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-[12px] text-subtle">
      <span className="inline-flex items-center gap-1.5">
        <Moon size={13} aria-hidden /> {t('today.snoozedCount', { count })}
      </span>
      <button
        type="button"
        onClick={onBringBack}
        className="rounded-md px-2 py-1 font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
      >
        {t('today.bringBack')}
      </button>
    </div>
  )
}
