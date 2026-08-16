import { useCallback, useEffect, useState } from 'react'
import { Bell, Loader2, Plus, Search, X } from 'lucide-react'
import { useI18n } from '@/i18n/i18n'
import { browseCourses, mySubjects, type CatalogCourse } from '@/lib/catalog'
import { useAppData } from '@/app/providers/app-data'
import { SeatWatchModal } from '@/features/seats/SeatWatchModal'
import {
  myWatches,
  removeWatch,
  seatsOpen,
  termLabel,
  watchLimit,
  type SeatWatch,
} from '@/lib/seats'

const PAGE = 10

/**
 * The full-page seat watch list.
 *
 * Same data as the Today widget, with the room to show waitlist depth and
 * whether a section has been polled yet. The widget answers "any news?" at a
 * glance; this answers "what am I actually waiting on?"
 */
export function SeatWatchPanel() {
  const { t } = useI18n()
  const { courses } = useAppData()
  const [watches, setWatches] = useState<SeatWatch[] | null>(null)
  const [limit, setLimit] = useState(1)
  const [tick, setTick] = useState(0)
  // The code to open the picker on, '' for a blank one, null for closed.
  const [picking, setPicking] = useState<string | null>(null)

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
          onClick={() => setPicking('')}
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
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-border px-4 py-3.5">
          <Bell size={17} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-subtle">
            <span className="font-medium text-fg">{t('planner.watch.emptyTitle')}. </span>
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

      {watches !== null && !atLimit && (
        <CoursesToWatch
          myCourses={courses.filter((c) => c.code.trim()).map((c) => ({ code: c.code, title: c.title }))}
          onPick={setPicking}
        />
      )}

      {picking !== null && (
        <SeatWatchModal
          initialCode={picking || undefined}
          onClose={() => setPicking(null)}
          onAdded={refresh}
        />
      )}
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

/**
 * Something to act on, instead of an empty page.
 *
 * A page whose only content is "nothing here yet" reads as broken and gives a
 * student nowhere to go. Their own classes come first because those are the
 * ones they most likely want a different section of; the rest of their subjects
 * follow, so the page is useful before they have watched anything at all.
 */
function CoursesToWatch({
  myCourses,
  onPick,
}: {
  myCourses: { code: string; title: string }[]
  onPick: (code: string) => void
}) {
  const { t } = useI18n()
  const [browsed, setBrowsed] = useState<CatalogCourse[]>([])
  const [total, setTotal] = useState(0)
  const [subjects, setSubjects] = useState<string[]>([])
  const [more, setMore] = useState(false)

  useEffect(() => {
    let alive = true
    void (async () => {
      const subs = await mySubjects()
      if (!alive) return
      setSubjects(subs)
      const page = await browseCourses({ subjects: subs.slice(0, 4), limit: PAGE })
      if (!alive) return
      setBrowsed(page.rows)
      setTotal(page.total)
    })()
    return () => {
      alive = false
    }
  }, [])

  async function loadMore() {
    setMore(true)
    const page = await browseCourses({
      subjects: subjects.slice(0, 4),
      offset: browsed.length,
      limit: PAGE,
    })
    setBrowsed((prev) => [...prev, ...page.rows])
    setTotal(page.total)
    setMore(false)
  }

  // Their own courses would otherwise appear twice.
  const mine = new Set(myCourses.map((c) => c.code.toUpperCase().replace(/[^A-Z0-9]/g, '')))
  const rest = browsed.filter((c) => !mine.has(`${c.subject}${c.catalog}`))

  if (myCourses.length === 0 && rest.length === 0) return null

  return (
    <div className="mt-5">
      {myCourses.length > 0 && (
        <>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            {t('planner.watch.yourClasses')}
          </h3>
          <ul className="mb-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {myCourses.slice(0, 8).map((c) => (
              <PickRow key={c.code} code={c.code} title={c.title} onPick={onPick} />
            ))}
          </ul>
        </>
      )}

      {rest.length > 0 && (
        <>
          <h3 className="mb-2 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            {subjects.length > 0
              ? t('planner.watch.inYourSubjects', { subjects: subjects.slice(0, 4).join(', ') })
              : t('planner.watch.browseAll')}
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {rest.map((c) => (
              <PickRow
                key={c.id}
                code={`${c.subject} ${c.catalog}`}
                title={c.title}
                onPick={onPick}
              />
            ))}
          </ul>
          {browsed.length < total && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={more}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[13px] font-medium text-muted transition-colors duration-150 hover:border-accent hover:text-fg disabled:opacity-60"
            >
              {more && <Loader2 size={13} className="animate-spin" aria-hidden />}
              {t('planner.dir.loadMore', { shown: browsed.length, total })}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function PickRow({
  code,
  title,
  onPick,
}: {
  code: string
  title: string
  onPick: (code: string) => void
}) {
  const { t } = useI18n()
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(code)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2"
      >
        <span className="min-w-0 flex-1">
          <span className="text-[13px] font-semibold text-fg">{code}</span>
          {title && <span className="ml-2 truncate text-[12px] text-subtle">{title}</span>}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-subtle">
          <Search size={11} aria-hidden />
          {t('planner.watch.findSections')}
        </span>
      </button>
    </li>
  )
}
