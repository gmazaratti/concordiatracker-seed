import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Plus, X } from 'lucide-react'
import { useI18n } from '@/i18n/i18n'
import { SeatWatchModal } from '@/features/seats/SeatWatchModal'
import {
  myWatches,
  removeWatch,
  seatsOpen,
  termLabel,
  watchLimit,
  type SeatWatch,
} from '@/lib/seats'

/**
 * The full-page seat watch list.
 *
 * Same data as the Today widget, with the room to show waitlist depth and
 * whether a section has been polled yet. The widget answers "any news?" at a
 * glance; this answers "what am I actually waiting on?"
 */
export function SeatWatchPanel() {
  const { t } = useI18n()
  const [watches, setWatches] = useState<SeatWatch[] | null>(null)
  const [limit, setLimit] = useState(1)
  const [tick, setTick] = useState(0)
  const [picking, setPicking] = useState(false)

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const [rows, lim] = await Promise.all([myWatches().catch(() => []), watchLimit()])
      if (!alive) return
      setWatches(rows)
      setLimit(lim)
    })()
    return () => {
      alive = false
    }
  }, [tick])

  const used = watches?.length ?? 0
  const atLimit = watches !== null && used >= limit

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] text-subtle">
          {watches === null
            ? ''
            : limit === 1
              ? t('planner.watch.usedOne', { used })
              : t('planner.watch.used', { used, limit })}
        </p>
        <button
          type="button"
          onClick={() => setPicking(true)}
          disabled={atLimit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={14} aria-hidden />
          {t('planner.watch.add')}
        </button>
      </div>

      {watches === null ? (
        <div className="grid place-items-center py-14">
          <Loader2 className="size-5 animate-spin text-accent" aria-hidden />
        </div>
      ) : watches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
          <Bell size={22} className="mx-auto text-subtle" aria-hidden />
          <h2 className="mt-2 font-display text-[17px] font-medium text-fg">
            {t('planner.watch.emptyTitle')}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] leading-relaxed text-subtle">
            {t('planner.watch.emptyBody')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {watches.map((w) => (
            <WatchRow key={w.id} watch={w} onRemove={() => void removeWatch(w.id).then(refresh)} />
          ))}
        </ul>
      )}

      {atLimit && used > 0 && (
        <p className="mt-3 text-[12px] text-subtle">{t('planner.watch.atLimit')}</p>
      )}

      {picking && <SeatWatchModal onClose={() => setPicking(false)} onAdded={refresh} />}
    </>
  )
}

function WatchRow({ watch, onRemove }: { watch: SeatWatch; onRemove: () => void }) {
  const { t } = useI18n()
  const free = seatsOpen(watch)
  const course = `${watch.subject} ${watch.catalog}`

  // Never-polled and full read very differently to someone waiting on a seat,
  // so they get different sentences rather than a shared "0 seats".
  const state =
    watch.checked_at === null
      ? t('planner.watch.waiting')
      : free !== null && free > 0
        ? free === 1
          ? t('planner.watch.openNowOne')
          : t('planner.watch.openNow', { n: free })
        : watch.last_waitlist_total
          ? t('planner.watch.fullWaitlist', { n: watch.last_waitlist_total })
          : t('planner.watch.full')

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2">
          <span className="text-[13.5px] font-medium text-fg">{course}</span>
          <span className="text-[12px] text-subtle">
            {watch.section} · {termLabel(watch.term_code)}
          </span>
        </span>
        <span className="mt-0.5 block text-[11.5px] text-subtle">
          {state}
          {watch.has_reserved ? ` · ${t('planner.watch.reserved')}` : ''}
        </span>
      </span>

      {free !== null && free > 0 && (
        <span className="shrink-0 rounded bg-success/15 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-success uppercase">
          {t('planner.watch.open')}
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={t('planner.watch.stop', { course })}
        className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
      >
        <X size={14} aria-hidden />
      </button>
    </li>
  )
}
