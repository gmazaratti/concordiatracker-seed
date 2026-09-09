import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useUiState } from '@/app/providers/ui-state'
import { useAppData } from '@/app/providers/app-data'
import { usePeopleBadge } from '@/app/usePeopleBadge'
import { PeoplePanel } from '@/features/profile/PeoplePanel'
import { cn } from '@/lib/cn'
import { EventsFeed } from './EventsFeed'
import { CommunityRail } from './CommunityRail'
import { ActivityButton, ActivityPanel } from './ActivityPanel'
import { CommunitySearch } from './CommunitySearch'
import {
  COMMUNITY_SECTIONS,
  communityHref,
  isCommunitySection,
  type CommunitySection,
} from './sections'

/**
 * Community — the part of the app that is about everyone else.
 *
 * It is four places, not one, and it is laid out the way every app a student
 * already uses lays this out: a mixed home, somewhere to find things, messages,
 * and you — with notifications behind a bell in the top right rather than
 * spending a permanent slot.
 *
 * That familiarity is the design. Nobody should have to learn this tab; they
 * have used its shape every day for a decade, and the friction of an
 * unfamiliar arrangement costs more than any cleverness would buy.
 *
 * On a PHONE the sections live in the bottom bar, which morphs when you enter
 * (see MobileNav). On DESKTOP the sidebar is already there, so they are a strip
 * under the title — the same content reached the way each screen expects.
 */
export function CommunityPage() {
  const { loaded, uiState, patchUiState } = useUiState()
  const { user } = useAppData()
  const [params, setParams] = useSearchParams()
  const waiting = usePeopleBadge()
  const [activity, setActivity] = useState(false)

  // Completes the getting-started "Explore Community" step.
  useEffect(() => {
    if (loaded && !uiState.communityVisited) patchUiState({ communityVisited: true })
  }, [loaded, uiState.communityVisited, patchUiState])

  const raw = params.get('c')
  const section: CommunitySection = isCommunitySection(raw) ? raw : 'home'

  const go = (next: CommunitySection) => {
    const p = new URLSearchParams(params)
    if (next === 'home') {
      p.delete('c')
      p.delete('chat')
    } else p.set('c', next)
    setParams(p)
  }

  const badgeFor = useMemo(
    () => (id: CommunitySection) => (id === 'messages' ? waiting : 0),
    [waiting],
  )

  return (
    <div className="mx-auto w-full max-w-[76rem] px-5 py-5 sm:px-6">
      {/* ── Header ─────────────────────────────────────────────────────────
          Title, a way to search orgs, the bell, and your own avatar — the four
          things every social header carries, in the order they carry them. */}
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-subtle">Around campus</p>
          <h1 className="mt-0.5 font-display text-[26px] leading-tight font-medium text-fg">
            Community
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ActivityButton count={waiting} onOpen={() => setActivity(true)} />
          {user.handle && (
            <Link
              to={`/@${user.handle}`}
              aria-label="My profile"
              title="My profile"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-semibold text-muted ring-1 ring-border transition-all duration-150 hover:ring-accent active:scale-95"
            >
              {(user.name || user.handle).slice(0, 2).toUpperCase()}
            </Link>
          )}
        </div>
      </header>

      {/* Desktop only: the phone reaches these from the bottom bar, and two
          navigations for one set of destinations is the clutter this whole
          layout exists to avoid. */}
      <nav className="mb-4 hidden gap-1 border-b border-border md:flex" role="tablist">
        {COMMUNITY_SECTIONS.map((s) => {
          const on = section === s.id
          const badge = badgeFor(s.id)
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go(s.id)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                on ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <s.icon size={14} aria-hidden />
              {s.label}
              {badge > 0 && (
                <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-accent-contrast">
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {section === 'home' && <HomeSection />}
      {section === 'events' && (
        <div className="flex gap-6">
          <div className="min-w-0 flex-1">
            <EventsFeed />
          </div>
          <CommunityRail />
        </div>
      )}
      {section === 'messages' && <PeoplePanel />}
      {section === 'profile' && <YouSection handle={user.handle} />}

      {activity && <ActivityPanel onClose={() => setActivity(false)} />}
    </div>
  )
}

/**
 * Home: the mixed view.
 *
 * Deliberately the same feed as Events for now rather than a second, subtly
 * different one — two feeds that look alike and rank differently is how people
 * stop trusting either. What Home adds is the way IN: a search that finds
 * ORGANISATIONS, which the tab has never had. Until today the only way to find
 * a club was to wait for it to post.
 */
function HomeSection() {
  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="rounded-xl border border-border bg-surface p-3">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            <Search size={12} aria-hidden />
            Find a club or society
          </p>
          <CommunitySearch />
        </div>
        <EventsFeed />
      </div>
      <CommunityRail />
    </div>
  )
}

/** Your own corner: a way to your profile without knowing your own handle. */
function YouSection({ handle }: { handle?: string }) {
  if (!handle) {
    return (
      <p className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-[13px] text-subtle">
        Pick a handle in Settings and your profile appears here.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {[
        { to: `/@${handle}`, title: 'My profile', body: 'What other students see when they find you.' },
        {
          to: communityHref('messages'),
          title: 'Messages and connections',
          body: 'Conversations, requests waiting on you, and who you follow.',
        },
        {
          to: '/app/community?c=events',
          title: 'Events I saved',
          body: 'Anything you added to your calendar shows up there too.',
        },
      ].map((row) => (
        <Link
          key={row.to}
          to={row.to}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-colors duration-150 hover:border-accent active:scale-[0.99]"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-fg">{row.title}</span>
            <span className="block text-[12px] leading-relaxed text-subtle">{row.body}</span>
          </span>
        </Link>
      ))}
    </div>
  )
}
