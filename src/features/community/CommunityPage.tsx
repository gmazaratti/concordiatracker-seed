import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUiState } from '@/app/providers/ui-state'
import { useAppData } from '@/app/providers/app-data'
import { usePeopleBadge } from '@/app/usePeopleBadge'
import { PeoplePanel } from '@/features/profile/PeoplePanel'
import { ProfileView } from '@/features/profile/UserProfilePage'
import { Mascot } from '@/components/Mascot'
import { cn } from '@/lib/cn'
import { EventsFeed } from './EventsFeed'
import { CommunityRail } from './CommunityRail'
import { ActivityButton, ActivityPanel } from './ActivityPanel'
import { CommunitySearchBar } from './SearchOverlay'
import {
  COMMUNITY_SECTIONS,
  DEFAULT_SECTION,
  isCommunitySection,
  type CommunitySection,
} from './sections'

/**
 * Community — the part of the app that is about everyone else.
 *
 * THREE SECTIONS, ONE SET OF CONTROLS. The rule this page is built on, after a
 * first version that broke it badly: a control appears in the section it acts
 * on and nowhere else. Search belongs to the sections where you are looking for
 * something. The bell belongs to Events, the landing section, because that is
 * where you go to catch up. Your own avatar belongs nowhere here at all — the app's own top bar
 * already carries it, and putting a second one under it made the same face
 * appear twice on one screen.
 *
 * THERE IS NO PAGE TITLE. A word saying "Community" above a bottom bar whose
 * Community tab is lit costs a fifth of a phone screen to repeat something the
 * screen already says. The sections lead instead.
 *
 * On a PHONE the sections live in the bottom bar, which morphs when you enter
 * (see MobileNav). On DESKTOP the sidebar is already spent on the app's own
 * destinations, so they are a strip under the search — the same content reached
 * the way each screen expects.
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
  const section: CommunitySection = isCommunitySection(raw) ? raw : DEFAULT_SECTION

  const go = (next: CommunitySection) => {
    const p = new URLSearchParams(params)
    if (next === DEFAULT_SECTION) {
      p.delete('c')
      p.delete('chat')
    } else p.set('c', next)
    setParams(p)
  }

  // You is a profile, and a profile is its own header — banner, avatar, name.
  // Stacking a search bar on top of one is how the old version ended up with
  // two faces and two headers on a 375px screen.
  const showSearch = section !== 'profile'

  return (
    <div className="mx-auto w-full max-w-[76rem] px-4 py-3 sm:px-6 sm:py-5">
      <h1 className="sr-only">Community</h1>

      {showSearch && (
        <div className="mb-3 flex items-center gap-2">
          <CommunitySearchBar className="md:max-w-md" />
          {/* Landing section only. Notifications are a thing you open, clear
              and leave —
              carrying the bell into every section made it read as part of the
              furniture rather than as something with news in it. */}
          {section === DEFAULT_SECTION && (
            <ActivityButton count={waiting} onOpen={() => setActivity(true)} />
          )}
        </div>
      )}

      {/* Desktop only: the phone reaches these from the bottom bar, and two
          navigations for one set of destinations is the clutter this whole
          layout exists to avoid. */}
      <nav className="mb-4 hidden gap-1 border-b border-border md:flex" role="tablist">
        {COMMUNITY_SECTIONS.map((s) => {
          const on = section === s.id
          const badge = s.id === 'messages' ? waiting : 0
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

      {/* Keyed on the section so the animation replays on every switch, and so
          React tears the old section down rather than reconciling two
          different screens into each other. */}
      <div key={section} className="ct-section-in">
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
      </div>

      {activity && <ActivityPanel onClose={() => setActivity(false)} />}
    </div>
  )
}

/**
 * You: your own profile, exactly as anyone else sees it — with the edit
 * controls on top of it.
 *
 * The previous version was three links to other screens, which is a menu, not a
 * profile. You cannot tell whether your bio reads well from a list of links to
 * places where your bio might be. This is the same component `/@handle` renders
 * for a visitor, so what you see here is what they get, and Edit is right on it.
 */
function YouSection({ handle }: { handle?: string }) {
  if (!handle) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-14 text-center">
        <Mascot mood="resting" size="sm" soft className="text-accent" />
        <p className="text-[13.5px] font-medium text-fg">No handle yet</p>
        <p className="max-w-xs text-[12.5px] leading-relaxed text-subtle">
          Pick one in Settings and your profile appears here — the same page classmates see when
          they find you.
        </p>
      </div>
    )
  }
  return <ProfileView key={handle} handle={handle} viewer="self" embedded />
}
