import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  Bookmark,
  ChevronLeft,
  Download,
  FileText,
  Loader2,
  Menu,
  Repeat2,
  ShieldCheck,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { StudentLayout } from '@/layouts/StudentLayout'
import { NotFoundPage } from '@/features/NotFoundPage'
import { HANDLE_RE } from '@/features/onboarding/handle'
import { communityHref } from '@/features/community/sections'
import { Mascot } from '@/components/Mascot'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { cn } from '@/lib/cn'
import { supabase } from '@/lib/supabase'
import { EditProfileModal } from './EditProfileModal'
import { ScheduleAccess } from './ScheduleAccess'
import { usePublicProfile, type PublicBlueprint, type PublicProfile } from './usePublicProfile'
import { badgeForPerson } from './badges'
import { ProfileHeader, ProfileTabs } from './ProfileHeader'
import { AvatarMenu } from '@/components/AvatarMenu'
import { NotificationsBell } from '@/components/NotificationsBell'
import { ProfileSkeleton } from '@/components/ui/Skeleton'
import { ProfileCreateMenu } from './ProfileCreateMenu'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { SavedTab } from './SavedTab'
import { RepostsTab } from '@/features/community/posts/RepostsTab'
import { useSupport } from '@/app/providers/support'
import { useCommunityData } from '@/app/providers/community-data'

/**
 * Public user profile at `/@handle` — viewable by ANYONE (anon included). The
 * page can only show what the SECURITY DEFINER RPCs return: a public profile's
 * name / avatar / program / bio + courses + blueprints, or — for a private
 * profile — just the handle and a lock. Lives outside the student app shell.
 */
export function UserProfilePage() {
  const { handle: raw } = useParams()
  if (!raw) return <NotFoundPage />
  // `/@john` is the canonical form and the one every link uses. `/john` is what
  // people type, so it is accepted and sent to the canonical URL rather than
  // 404ing at someone who guessed a reasonable address. `replace` so Back does
  // not land on the redirect and bounce forward again.
  if (!raw.startsWith('@')) {
    return HANDLE_RE.test(raw) ? <Navigate to={`/@${raw}`} replace /> : <NotFoundPage />
  }
  const handle = raw.slice(1)
  // Key by handle so navigating between profiles remounts with fresh state.
  return <ProfileShell key={handle} handle={handle} />
}

/**
 * The same page, with or without the app around it.
 *
 * `/@handle` is one URL that has to serve two people: a signed-out visitor who
 * followed a shared link and has no account, and a student who is already
 * inside the app. Rendering it bare for both meant the second one lost their
 * sidebar and got told to sign up for the account they were signed into.
 *
 * The URL does not change either way. Redirecting a signed-in viewer to some
 * in-app copy would break the one thing this address is for, which is being
 * shareable.
 */
function ProfileShell({ handle }: { handle: string }) {
  const viewer = useViewer(handle)

  // Nothing is rendered until we know, because the two versions differ in
  // their whole chrome and flashing one then the other is worse than a beat of
  // nothing.
  if (viewer === 'loading') {
    return (
      <div className="grid min-h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  if (viewer === 'anon') {
    return (
      <div className="min-h-svh bg-canvas">
        <header className="sticky top-0 z-10 border-b border-border bg-canvas/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-3">
            <Link to="/" aria-label="ConcordiaTracker home">
              <Logo />
            </Link>
            <Link
              to="/app"
              className="rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              Sign up free
            </Link>
          </div>
        </header>
        {/* The signed-in case gets its <main> from StudentLayout; a signed-out
            visitor has no shell, so the landmark lives here. */}
        <main>
          <ProfileView handle={handle} viewer={viewer} />
        </main>
      </div>
    )
  }

  return (
    <StudentLayout>
      <ProfileView handle={handle} viewer={viewer} />
    </StudentLayout>
  )
}

export function ProfileView({
  handle,
  viewer,
  embedded = false,
}: {
  handle: string
  viewer: 'self' | 'other' | 'anon'
  /**
   * Rendered inside Community's "You" section rather than at `/@handle`.
   *
   * Same page, same components, same data — so what you see in the app is
   * literally what a visitor gets. What embedding drops is the chrome that
   * would be duplicated: the page's own gutter (the section already has one),
   * the "back to Community" link (you are IN Community), and the document
   * title/canonical, which must keep pointing at `/@handle` and not be
   * rewritten by a tab.
   */
  embedded?: boolean
}) {
  const { loading, notFound, profile, blueprints, reload } = usePublicProfile(handle)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  /**
   * THREE TABS, AND OUTLINES IS FIRST, as asked.
   *
   * They are not new content — they are the sections that were already
   * stacked down this page, which meant a third-year's profile was a wall you
   * scrolled past to reach anything. What a student publishes here is an
   * outline, so that leads; reposts are the second thing they chose to pass
   * on; classes are the fact about them.
   */
  const [tab, setTab] = useState('outlines')
  /*
   * The seal, and what colour it is. Staff is the closed set above; organizer
   * is DERIVED from owning an approved org, so it turns up when they are
   * approved and goes away if the org does — nobody has to remember to
   * revoke it. See features/profile/badges.ts for why the colours differ.
   */
  const { orgNameByOwner } = useCommunityData()
  const { openSupport } = useSupport()
  const badge = badgeForPerson(handle, profile ? orgNameByOwner[profile.userId] : undefined)

  /*
   * A RESERVED HANDLE RESOLVES SERVER-SIDE, so `/@ceo` returns Alex's row with
   * `handle: "alex"` on it. The address bar has to follow: leaving it saying
   * "ceo" would mean one person's profile living at a URL that is not theirs,
   * which breaks sharing, the canonical tag and anybody's ability to tell whose
   * page they are looking at. `replace` so Back leaves the alias behind.
   */
  if (!embedded && profile && profile.handle.toLowerCase() !== handle.toLowerCase()) {
    return <Navigate to={`/@${profile.handle}`} replace />
  }

  return (
    <>
      {!embedded && <ProfileMeta handle={handle} profile={profile} />}

      {/* The handle where the wordmark was. Instagram's profile bar, and the
          reason the app's own bar stands down on this screen. */}
      {viewer !== 'anon' && (
        /*
         * ONE BAR, three things: create on the left, who you are in the
         * middle, notifications and the menu on the right — the reference's
         * arrangement. The bell used to sit on its OWN row above this one,
         * courtesy of the section wrapper, so the profile opened with two
         * strips of chrome before a single fact about the person.
         */
        <div className="sticky top-0 z-20 flex items-center gap-1 border-b border-border bg-canvas/90 px-2 py-2 backdrop-blur-xl md:hidden">
          {viewer === 'self' ? <ProfileCreateMenu /> : <span className="size-9 shrink-0" />}
          <h2 className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
            <span className="truncate text-[17px] font-semibold text-fg">{handle}</span>
            {badge && <VerifiedBadge size={15} tone={badge.tone} label={badge.label} />}
          </h2>
          {viewer === 'self' && <NotificationsBell variant="profile" />}
          <AvatarMenu align="top" compact icon={<Menu size={19} aria-hidden />} />
        </div>
      )}

      <div className={cn(!embedded && 'mx-auto w-full max-w-3xl px-5 py-5 sm:px-6', embedded && 'pt-4')}>
        {/* Community, not Today. You arrive here from a search or a mention in
            Community, and the app's default landing page is not where you were
            a second ago. */}
        {viewer !== 'anon' && !embedded && (
          <Link
            to={communityHref('messages')}
            className="mb-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg"
          >
            <ChevronLeft size={14} aria-hidden />
            Community
          </Link>
        )}
        {loading ? (
          <ProfileSkeleton />
        ) : notFound || !profile ? (
          <NotFound handle={handle} />
        ) : (
          <>
            {/*
              THE HEADER IS ONE COMPONENT NOW (ProfileHeader), Instagram's
              shape in our colours: a large avatar, the handle with its seal,
              Orgs / Followers / Following as buttons into the list behind
              each, the major as the coloured category line, the bio capped
              at three lines, links, mutuals, then Follow / Message / bell.
              It was a banner plus six ad-hoc blocks that each decided their
              own spacing.
            */}
            <ProfileHeader
              handle={profile.handle}
              name={profile.name}
              avatarUrl={profile.avatarUrl}
              program={profile.program}
              bio={profile.bio}
              links={profile.links}
              isPublic={profile.isPublic}
              isSelf={viewer === 'self'}
              role={badge?.role}
              onEdit={() => setEditing(true)}
              onMessage={() => navigate(`/app/community?c=messages&chat=${profile.handle}`)}
              /* Only on the support account: somebody landing there with a
                 problem should not have to find that support lives behind
                 the avatar menu, and a DM has no case number. */
              onHelp={badge?.kind === 'staff' && viewer === 'other' ? () => openSupport() : undefined}
            />

            {profile.isPublic && (
              <>
                {/* Only on someone else's: your own schedule is the
                    planner, one tab away, and "request" makes no sense
                    pointed at yourself. */}
                {viewer === 'other' && (
                  <ScheduleAccess handle={profile.handle} name={profile.name} />
                )}

                <ProfileTabs
                  active={tab}
                  onChange={setTab}
                  tabs={[
                    { id: 'outlines', label: 'Outlines', icon: FileText, count: blueprints.length },
                    { id: 'reposts', label: 'Reposts', icon: Repeat2 },
                    // SAVED IS YOURS ALONE. It replaces the old Classes tab:
                    // the class list is a fact about you that belongs with the
                    // rest of the profile prose, while a bookmark is a private
                    // list that needs somewhere to live.
                    ...(viewer === 'self'
                      ? [{ id: 'saved', label: 'Saved', icon: Bookmark }]
                      : []),
                  ]}
                />

                {tab === 'outlines' &&
                  (blueprints.length > 0 ? (
                    <ul className="space-y-2 pt-4">
                      {blueprints.map((b) => (
                        <BlueprintRow key={b.id} bp={b} />
                      ))}
                    </ul>
                  ) : (
                    <TabEmpty>
                      {viewer === 'self'
                        ? 'Share a syllabus and the next student in your section imports it in one click.'
                        : 'No outlines shared yet.'}
                    </TabEmpty>
                  ))}

                {tab === 'reposts' && (
                  <RepostsTab
                    handle={profile.handle}
                    onOpenEvent={(id) => navigate(`/app/community?event=${id}`)}
                  />
                )}

                {tab === 'saved' && viewer === 'self' && <SavedTab />}

              </>
            )}
          </>
        )}
      </div>

      {editing && <EditProfileModal onClose={() => setEditing(false)} onSaved={reload} />}
    </>
  )
}

/**
 * Title, description and canonical for the standalone `/@handle` page.
 *
 * Its own component so it can be left out when the profile is embedded in a
 * tab: `usePageMeta` is a hook and cannot be called conditionally, and a tab
 * quietly rewriting the canonical URL of the page you are on is a real SEO bug,
 * not a cosmetic one.
 */
function ProfileMeta({ handle, profile }: { handle: string; profile: PublicProfile | null }) {
  usePageMeta({
    title:
      profile?.name
        ? `${profile.name} (@${profile.handle}) · ConcordiaTracker`
        : `@${handle} · ConcordiaTracker`,
    description:
      profile?.name
        ? `${profile.name}${profile.program ? ` · ${profile.program}` : ''} on ConcordiaTracker.`
        : undefined,
    path: `/@${handle}`,
    // Public profiles are indexable; private ones are not.
    robots: profile && !profile.isPublic ? 'noindex,follow' : 'index,follow',
  })
  return null
}

/**
 * Is this your own profile, someone else's, or are you signed out?
 *
 * Three answers, not two: a signed-out visitor must see neither an Edit button
 * nor an Add-friend button that cannot work, and "still deciding" has to be
 * distinguishable from "not you" so the page never flashes the wrong control.
 */
function useViewer(handle: string): 'self' | 'other' | 'anon' | 'loading' {
  const [state, setState] = useState<'self' | 'other' | 'anon' | 'loading'>('loading')
  useEffect(() => {
    let alive = true
    void (async () => {
      const { data } = await supabase.auth.getUser()
      if (!alive) return
      if (!data.user) return setState('anon')
      const { data: row } = await supabase
        .from('user_profile')
        .select('handle')
        .eq('user_id', data.user.id)
        .maybeSingle()
      if (!alive) return
      const mine = (row as { handle?: string } | null)?.handle ?? ''
      setState(mine.toLowerCase() === handle.toLowerCase() ? 'self' : 'other')
    })()
    return () => {
      alive = false
    }
  }, [handle])
  return state
}


function BlueprintRow({ bp }: { bp: PublicBlueprint }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] font-semibold text-fg">
          {bp.courseCode}
          {bp.section && <span className="text-subtle">· Section {bp.section}</span>}
          {bp.verified && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent">
              <ShieldCheck size={13} aria-hidden /> Teacher-verified
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[12px] text-subtle">
          {bp.itemCount} item{bp.itemCount === 1 ? '' : 's'} · {bp.term}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-[12px] text-subtle">
        <span className="tabular-nums">▲ {bp.net}</span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <Download size={12} aria-hidden /> {bp.imports}
        </span>
      </div>
    </li>
  )
}

/** An empty tab says what would fill it, and says it differently to the
 *  person who could. A visitor reading "upload a syllabus" would be reading
 *  somebody else's to-do list. */
function TabEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-xl border border-dashed border-border px-5 py-10 text-center text-[12.5px] leading-relaxed text-subtle">
      {children}
    </p>
  )
}

function NotFound({ handle }: { handle: string }) {
  return (
    <div className="grid place-items-center gap-3 py-24 text-center">
      {/* A handle nobody has taken is a search that found nothing, which is
          exactly what `sad` is for — never for actual bad news. */}
      <Mascot mood="sad" size="md" soft className="text-accent" />
      <p className="text-[15px] font-medium text-fg">@{handle} isn’t here</p>
      <p className="max-w-xs text-[13px] text-subtle">No ConcordiaTracker user has that handle.</p>
      <Link
        to="/app"
        className="mt-1 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors hover:bg-accent-hover"
      >
        Go to ConcordiaTracker
      </Link>
    </div>
  )
}

/** Stable, pleasant banner gradient derived from the handle (no upload needed). */
/** Brand-tinted aurora, used only for the founder header. */
