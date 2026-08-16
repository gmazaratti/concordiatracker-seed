import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { SeatWatchModal } from '@/features/seats/SeatWatchModal'
import { myWatches, removeWatch, seatsOpen, termLabel, type SeatWatch } from '@/lib/seats'
import { WidgetCard, WidgetEmpty } from './WidgetCard'

/**
 * The classes you're waiting on a seat for.
 *
 * A watch that has never been polled shows "checking", not "0 seats" — the
 * poller deliberately doesn't notify on a first observation either, and the
 * widget shouldn't imply a state it hasn't measured.
 */
export function SeatWatchWidget() {
  const [watches, setWatches] = useState<SeatWatch[] | null>(null)
  const [tick, setTick] = useState(0)
  const [picking, setPicking] = useState(false)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const rows = await myWatches().catch(() => [])
      if (alive) setWatches(rows)
    })()
    return () => {
      alive = false
    }
  }, [tick])

  async function drop(id: string) {
    await removeWatch(id).catch(() => {})
    refresh()
  }

  return (
    <>
      <WidgetCard
        title="Seat watch"
        icon={Bell}
        action={
          <button
            type="button"
            onClick={() => setPicking(true)}
            aria-label="Watch another class"
            className="grid size-6 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <Plus size={13} aria-hidden />
          </button>
        }
      >
        {watches === null ? (
          <div className="grid place-items-center py-5">
            <Loader2 className="size-4 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : watches.length === 0 ? (
          <WidgetEmpty>
            Watching a full class pushes you the moment a seat opens.{' '}
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="font-medium text-accent hover:underline"
            >
              Add one
            </button>
            .
          </WidgetEmpty>
        ) : (
          <ul className="divide-y divide-border/60">
            {watches.map((w) => {
              const free = seatsOpen(w)
              return (
                <li key={w.id} className="flex items-center gap-2 px-3.5 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-fg">
                      {w.subject} {w.catalog} · {w.section}
                    </span>
                    <span className="block truncate text-[11px] text-subtle">
                      {termLabel(w.term_code)}
                      {w.checked_at === null
                        ? ' · checking…'
                        : free === null
                          ? ''
                          : free > 0
                            ? ` · ${free} seat${free === 1 ? '' : 's'} open`
                            : ` · full${w.last_waitlist_total ? ` · ${w.last_waitlist_total} waiting` : ''}`}
                    </span>
                  </span>
                  {free !== null && free > 0 && (
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
                        'bg-success/15 text-success',
                      )}
                    >
                      Open
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void drop(w.id)}
                    aria-label={`Stop watching ${w.subject} ${w.catalog}`}
                    className="grid size-5 shrink-0 place-items-center rounded text-subtle transition-colors duration-150 hover:text-danger"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </WidgetCard>

      {picking && <SeatWatchModal onClose={() => setPicking(false)} onAdded={refresh} />}
    </>
  )
}
