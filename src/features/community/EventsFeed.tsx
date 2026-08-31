import { useMemo, useState } from 'react'
import {
  CalendarRange,
  ChevronDown,
  LayoutGrid,
  Rows3,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useAppData } from '@/app/providers/app-data'
import { usePrefersReducedMotion } from '@/app/hooks/usePrefersReducedMotion'
import { isRelevantTo, type EventCategory } from '@/data/community'
import { startOfToday } from '@/lib/date'
import { cn } from '@/lib/cn'
import { CATEGORY_META, CATEGORY_ORDER } from './category'
import { EventTile } from './EventTile'
import { AnimatedEventList } from './AnimatedEventList'
import { EventDetail } from './EventDetail'
import { CommunitySearch } from './CommunitySearch'
import { NotificationsBell } from './NotificationsBell'
import { FollowingMenu } from './FollowingMenu'
import { useEventActions } from './useEventActions'
import { useCommunity } from './useCommunity'

type CatFilter = 'all' | EventCategory

/** The events feed — org search + notifications + a pinned following bar above
 * upcoming events, filterable by category and (opt-in) your own program, in a
 * card grid or dense rows. Clicking opens a full-screen detail (`?event=`);
 * filtering reflows with a FLIP animation. */
export function EventsFeed() {
  const { user, communityView, setCommunityView } = useAppData()
  const reduced = usePrefersReducedMotion()
  const { events } = useCommunity()
  const { isAdded, add, openEvent, closeEvent, selectedEvent } = useEventActions()
  const [filter, setFilter] = useState<CatFilter>('all')
  const [forYou, setForYou] = useState(false)

  const today = startOfToday()
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => new Date(e.start) >= today)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()),
    [events, today],
  )
  const visibleIds = useMemo(
    () =>
      new Set(
        upcoming
          .filter((e) => filter === 'all' || e.category === filter)
          .filter((e) => !forYou || isRelevantTo(e, user.program, user.school))
          .map((e) => e.id),
      ),
    [upcoming, filter, forYou, user.program, user.school],
  )

  const isCard = communityView === 'card'

  return (
    <div>
      {/* Search gets its own row below sm. Sharing one with two buttons left
          it about 180px wide, which is where the placeholder was being cut
          off — the fix is the layout, not a shorter string. */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <CommunitySearch />
        <div className="flex items-center gap-2">
          {/* The rail owns Following on xl+; this stays for narrower screens
              rather than being deleted, or they'd lose access to the list. */}
          <span className="xl:hidden">
            <FollowingMenu />
          </span>
          <NotificationsBell />
          <span className="ml-auto sm:hidden">
            <ViewToggle view={communityView} onChange={setCommunityView} />
          </span>
        </div>
      </div>

      {/* Below sm the chips are behind a disclosure. Six of them plus two
          controls wrapped to three rows and pushed the first event most of a
          screen down — on the one tab whose entire job is showing events. */}
      <FilterBar
        activeCount={(filter === 'all' ? 0 : 1) + (forYou ? 1 : 0)}
      >
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>
          All
        </Chip>
        {CATEGORY_ORDER.map((c) => (
          <Chip
            key={c}
            active={filter === c}
            onClick={() => setFilter(c)}
            icon={CATEGORY_META[c].icon}
            color={CATEGORY_META[c].hex}
          >
            {CATEGORY_META[c].label}
          </Chip>
        ))}

        <div className="flex items-center gap-1.5 sm:ml-auto">
          {user.program && (
            <button
              type="button"
              onClick={() => setForYou((v) => !v)}
              aria-pressed={forYou}
              className={cn(
                'rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-[transform,background-color,border-color,color] duration-150 active:scale-95',
                forYou
                  ? 'border-accent bg-accent-soft text-fg'
                  : 'border-border bg-surface text-muted hover:text-fg',
              )}
            >
              For my program
            </button>
          )}
          <span className="hidden sm:inline-flex">
            <ViewToggle view={communityView} onChange={setCommunityView} />
          </span>
        </div>
      </FilterBar>

      <AnimatedEventList
        key={communityView}
        events={upcoming}
        visibleIds={visibleIds}
        reduced={reduced}
        className={
          isCard
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex max-w-3xl flex-col gap-2.5'
        }
        empty={<EmptyState forYou={forYou} />}
        renderItem={(event) => (
          <EventTile
            event={event}
            view={communityView}
            relevant={isRelevantTo(event, user.program, user.school)}
            added={isAdded(event)}
            onOpen={() => openEvent(event.id)}
            onAdd={() => add(event)}
          />
        )}
      />

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          added={isAdded(selectedEvent)}
          onAdd={() => add(selectedEvent)}
          onClose={closeEvent}
          onOpenEvent={openEvent}
        />
      )}
    </div>
  )
}

function Chip({
  active,
  onClick,
  icon: Icon,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  icon?: LucideIcon
  color?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-[transform,background-color,border-color,color] duration-150 active:scale-95',
        active
          ? 'border-accent bg-accent-soft text-fg'
          : 'border-border bg-surface text-muted hover:text-fg',
      )}
    >
      {Icon && <Icon size={13} style={{ color }} aria-hidden />}
      {children}
    </button>
  )
}

const VIEW_OPTIONS = [
  { value: 'card' as const, label: 'Card view', icon: LayoutGrid },
  { value: 'row' as const, label: 'Row view', icon: Rows3 },
]

function ViewToggle({
  view,
  onChange,
}: {
  view: 'card' | 'row'
  onChange: (v: 'card' | 'row') => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Events layout"
      className="flex gap-1 rounded-lg border border-border bg-surface p-1"
    >
      {VIEW_OPTIONS.map((opt) => {
        const Icon = opt.icon
        const active = view === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              'grid size-7 place-items-center rounded-md transition-colors duration-150',
              active ? 'bg-surface-2 text-fg' : 'text-subtle hover:text-fg',
            )}
          >
            <Icon size={15} aria-hidden />
          </button>
        )
      })}
    </div>
  )
}

function EmptyState({ forYou }: { forYou: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface/50 px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <CalendarRange size={24} aria-hidden />
      </span>
      <h3 className="font-display text-xl font-medium text-fg">
        {forYou ? 'Nothing tagged for your program' : 'A quiet week on campus'}
      </h3>
      <p className="max-w-xs text-sm text-muted">
        {forYou
          ? 'Try clearing the “For my program” filter to see everything coming up.'
          : 'No events match this filter right now. New events show up here as orgs post them.'}
      </p>
    </div>
  )
}

/**
 * The filter row, collapsible below sm.
 *
 * Six category chips plus two controls wrapped to three rows on a phone and
 * pushed the first event most of a screen down — on the tab whose entire job is
 * showing events. Above sm there is room, so nothing is hidden and the button
 * does not exist. The count on the button is the point: a filter you have
 * forgotten is a filter that makes the app look broken.
 */
function FilterBar({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-[12.5px] font-medium text-muted transition-colors duration-150 active:bg-surface-2 sm:hidden"
      >
        <SlidersHorizontal size={14} aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="rounded bg-accent-soft px-1.5 text-[11px] font-semibold text-accent tabular-nums">
            {activeCount}
          </span>
        )}
        <ChevronDown
          size={14}
          aria-hidden
          className={cn('transition-transform duration-150', open && 'rotate-180')}
        />
      </button>

      <div
        className={cn(
          'flex-wrap items-center gap-1.5 sm:flex',
          open ? 'mt-2 flex' : 'hidden',
        )}
      >
        {children}
      </div>
    </div>
  )
}
