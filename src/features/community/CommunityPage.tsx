import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Users } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { usePeopleBadge } from '@/app/usePeopleBadge'
import { PeoplePanel } from '@/features/profile/PeoplePanel'
import { cn } from '@/lib/cn'
import { EventsFeed } from './EventsFeed'
import { CommunityRail } from './CommunityRail'

/** Community — "what's happening around me that isn't my own coursework." A pure,
 * outward-facing events aggregator (NOT a social feed): no posts, reactions, RSVP,
 * or friends. Cross-course teacher announcements live on Today, not here. */
export function CommunityPage() {
  const { loaded, uiState, patchUiState } = useUiState()
  // In the URL, so a Message button anywhere can link straight to a thread and
  // the back button behaves.
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'people' ? 'people' : 'events'
  const waiting = usePeopleBadge()

  const go = (next: 'events' | 'people') => {
    const p = new URLSearchParams(params)
    if (next === 'events') {
      p.delete('tab')
      p.delete('chat')
    } else p.set('tab', 'people')
    setParams(p)
  }
  // Completes the getting-started "Explore Community" step.
  useEffect(() => {
    if (loaded && !uiState.communityVisited) patchUiState({ communityVisited: true })
  }, [loaded, uiState.communityVisited, patchUiState])

  return (
    <div className="mx-auto w-full max-w-[76rem] px-5 py-5 sm:px-6">
      <header className="mb-4">
        <p className="text-[12px] text-subtle">Around campus</p>
        <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
          Community
        </h1>
        <p className="mt-0.5 text-[13px] text-subtle">
          Events, fairs, and the people around you: beyond your own coursework.
        </p>
      </header>

      {/* People lives here rather than as a sixth destination. It is the same
          job as the events feed — the part of the app that is about other
          people — and a top-level tab for a message list is a tab nobody
          asked for. */}
      <nav className="mb-4 flex gap-1 border-b border-border" role="tablist">
        {(
          [
            ['events', 'Events', CalendarDays, 0],
            ['people', 'People', Users, waiting],
          ] as const
        ).map(([id, label, Icon, badge]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => go(id)}
            className={cn(
              '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-150',
              tab === id ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
            )}
          >
            <Icon size={14} aria-hidden />
            {label}
            {badge > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-contrast">
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Rail sits beside the feed on wide screens; below xl the grid keeps
          the full width and the rail's contents stay reachable from the header. */}
      {tab === 'people' ? (
        <PeoplePanel />
      ) : (
        <div className="flex gap-6">
          <div className="min-w-0 flex-1">
            <EventsFeed />
          </div>
          <CommunityRail />
        </div>
      )}
    </div>
  )
}
