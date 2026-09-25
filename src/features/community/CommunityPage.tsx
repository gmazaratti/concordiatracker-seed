import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useUiState } from '@/app/providers/ui-state'
import { useAppData } from '@/app/providers/app-data'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { cn } from '@/lib/cn'
import { PeoplePanel } from '@/features/profile/PeoplePanel'
import { ProfileView } from '@/features/profile/UserProfilePage'
import { Mascot } from '@/components/Mascot'
import { EventsFeed } from './EventsFeed'
import { FeedSection } from './FeedSection'
import { CommunityRail } from './CommunityRail'
import { CommunitySearchBar } from './SearchOverlay'
import { DEFAULT_SECTION, isCommunitySection, type CommunitySection } from './sections'


/**
 * Community — the part of the app that is about everyone else.
 *
 * FOUR SECTIONS, ONE SET OF CONTROLS. The rule this page is built on, after a
 * first version that broke it badly: a control appears in the section it acts
 * on and nowhere else. Search belongs to the sections where you are looking for
 * something. The bell belongs to Feed, the landing section, because that is
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
  const [params] = useSearchParams()
  // The notifications panel lives in the app shell now (ActivityLayer).

  // Completes the getting-started "Explore Community" step.
  useEffect(() => {
    if (loaded && !uiState.communityVisited) patchUiState({ communityVisited: true })
  }, [loaded, uiState.communityVisited, patchUiState])

  const raw = params.get('c')
  const section: CommunitySection = isCommunitySection(raw) ? raw : DEFAULT_SECTION

  /*
   * SEARCH BELONGS TO THE SECTIONS THAT ARE DIRECTORIES.
   *
   * You is a profile and carries its own header. Feed is a river — a field
   * above it invites you to stop scrolling before you have started, which is
   * why Instagram puts search on a surface of its own. The app's magnifier in
   * the top bar covers that case on Feed; Events and Messages, where you are
   * genuinely looking for a thing, keep the field.
   */
  /*
   * Messages dropped out of this too. It now carries its own field at the top
   * — the one that narrows the conversations below it, which is the search
   * you want on that screen — and a second bar above it searching strangers
   * is the duplicate-control fault this page was rebuilt to remove. Finding
   * somebody new is the compose button, next to that field.
   */
  const showSearch = section === 'events'
  const full = section === 'messages'

  return (
    /*
     * MESSAGES TAKES THE WHOLE SCREEN. Everywhere else here is a document you
     * scroll, so it gets a reading column with air around it. A messenger is
     * not that: it is two panes that scroll independently inside a frame that
     * does not move, and the reading column was what made it read as an embed
     * floating on a page rather than the page itself.
     */
    <div
      className={cn(
        full
          ? 'flex h-full min-h-0 w-full flex-col overflow-hidden'
          : 'mx-auto w-full max-w-[76rem] px-4 py-3 sm:px-6 sm:py-5',
      )}
    >
      <h1 className="sr-only">Social</h1>

      {showSearch && (
        <div className="mb-3 flex items-center gap-2">
          <CommunitySearchBar className="md:max-w-md" />
        </div>
      )}

      {/*
        THE SECTIONS MOVED INTO THE SIDEBAR, nested under Social the way the
        planner's are. A strip across the top of the page was a second
        navigation bar under the first one, and the conversation pane — the
        part of this tab that actually wants the height — was paying for it.
        The phone still reaches them from the bottom bar.

        AND SO HAS THE BELL. One control alone on a full-width row bought a
        band of empty space across the top of every section to hold it, and
        it was only reachable from inside Social at all. On desktop it is in
        the sidebar footer beside settings, on screen everywhere.

        A PHONE HAS NO SIDEBAR, so it sits on YOUR OWN PROFILE — the section
        that is already about you, and the only one with room for it. On the
        feed it was pushing the stories row down the page, which is the one
        thing that has to be at the top: a row of rings is a queue you work
        through, and a queue below the fold is a queue nobody works through.
      */}
      {/* Nothing here any more on a phone: the profile bar carries the bell
          itself, beside the create menu, which is where the reference puts it
          and which stopped this section opening with two rows of chrome. */}

      {/* Keyed on the section so the animation replays on every switch, and so
          React tears the old section down rather than reconciling two
          different screens into each other. */}
      <div key={section} className={cn('ct-section-in', full && 'flex min-h-0 flex-1 flex-col')}>
        {/*
          ONE SECTION AT A TIME, and this is the containment the first boundary
          did not give. The page-level one wraps `<main>`, so a throw in
          Messages replaced the whole of Community — tab bar included — and
          every other section showed the same error until a reload. `resetKey`
          is the section, so switching tabs clears it: an error in one screen
          must not follow you to the next.
        */}
        <ErrorBoundary variant="page" resetKey={section}>
        {section === 'feed' && <FeedSection />}
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
        </ErrorBoundary>
      </div>

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
          Pick one in Settings and your profile appears here. It is the same page classmates see when
          they find you.
        </p>
      </div>
    )
  }
  return <ProfileView key={handle} handle={handle} viewer="self" embedded />
}
