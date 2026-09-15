import { formatDueDateTime } from '@/lib/date'

/** One synced deadline, as the panel shows it. */
export interface SyncedItem {
  id: string
  title: string
  due: string
  note: string | null
  moved_from: string | null
}

/** Ahead of you vs behind you. Module-level so reading the clock is allowed
 *  (`react-hooks/purity` forbids it inside a component body). */
function splitByTime(items: SyncedItem[]): { upcoming: SyncedItem[]; past: number } {
  const now = Date.now()
  const upcoming = items.filter((i) => new Date(i.due).getTime() >= now)
  return { upcoming, past: items.length - upcoming.length }
}

/**
 * What it actually found.
 *
 * The panel used to say "5 upcoming" and stop, which is a claim the student
 * has no way to check — and this feature already asks them to trust a link
 * they cannot read. Showing the rows is the cheapest honesty available: if
 * something is missing or wrong, they can see it here rather than discovering
 * it in week ten.
 *
 * Past items are counted but not listed. They are real (the sync keeps what it
 * already imported, because you may have ticked it off) and they are not what
 * anyone opens this panel to check.
 */
export function SyncedList({
  items,
  showAll,
  onShowAll,
}: {
  items: SyncedItem[]
  showAll: boolean
  onShowAll: () => void
}) {
  const { upcoming, past } = splitByTime(items)
  const shown = showAll ? upcoming : upcoming.slice(0, 6)

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[12.5px] text-subtle">
        Nothing imported yet. If Moodle has deadlines you expect to see here, press Sync now.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <p className="flex items-center justify-between gap-2 border-b border-border bg-surface-2/40 px-3 py-2 text-[11px] font-medium tracking-wide text-subtle uppercase">
        <span>From your Moodle calendar</span>
        <span className="tabular-nums normal-case">
          {upcoming.length} upcoming{past > 0 && ` · ${past} past`}
        </span>
      </p>

      {upcoming.length === 0 ? (
        <p className="px-3 py-4 text-center text-[12.5px] text-subtle">
          Everything Moodle knows about has already passed.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {shown.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] text-fg" title={i.title}>
                  {i.title}
                </span>
                {/* The course short name is the single most useful thing Moodle
                    sends, because it is what tells you which class this is. */}
                {i.note && (
                  <span className="block truncate text-[11px] text-subtle" title={i.note}>
                    {i.note}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right text-[11.5px] text-muted tabular-nums">
                {formatDueDateTime(i.due)}
                {i.moved_from && (
                  <span className="block text-[10.5px] text-warning">moved by Moodle</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!showAll && upcoming.length > shown.length && (
        <button
          type="button"
          onClick={onShowAll}
          className="w-full border-t border-border px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          Show all {upcoming.length}
        </button>
      )}
    </div>
  )
}
