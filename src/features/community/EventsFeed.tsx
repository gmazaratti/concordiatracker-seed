import { useMemo, useState } from 'react'
import {
  CalendarRange,
  LayoutGrid,
  Rows3,
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
      {/* No search, no bell, no following list here. Every one of those used to
          sit in this component AND again in the page header above it, which is
          how one screen ended up with two search fields and two bells. They
          belong to the section, not to the feed; the feed owns filtering. */}
      <FilterBar>
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
          <ViewToggle view={communityView} onChange={setCommunityView} />
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
 * The filter row: one line that scrolls sideways on a phone, wrapping above sm.
 */
function FilterBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      {/*
        Always visible, and it scrolls sideways on a phone.
        These used to hide behind a "Filters" disclosure below sm, because six
        chips plus two controls wrapped to three rows and pushed the first event
        most of a screen down. Hiding them was the wrong half of that trade:
        "what is on this weekend" is the question this tab exists to answer, and
        a filter nobody can see is a filter nobody uses.

        One scrolling row solves both — full height back for the events, and the
        categories in the place every app a student uses puts them. The edges
        fade rather than being cut, so it is obvious there is more sideways.
      */}
      <div className="relative -mx-4 sm:mx-0">
        <div
          className={cn(
            'flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:flex-wrap sm:overflow-visible sm:px-0',
            // Chrome only; the scrollbar itself would be a second horizontal
            // line under a row that is already one line tall.
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          )}
        >
          {children}
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-canvas to-transparent sm:hidden"
          aria-hidden
        />
      </div>
    </div>
  )
}
