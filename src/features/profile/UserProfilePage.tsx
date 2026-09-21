import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Repeat2,
  ShieldCheck,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { StudentLayout } from '@/layouts/StudentLayout'
import { CourseChip } from '@/components/CourseChip'
import { Switch } from '@/features/settings/controls'
import { NotFoundPage } from '@/features/NotFoundPage'
import { HANDLE_RE } from '@/features/onboarding/handle'
import { communityHref } from '@/features/community/sections'
import { Mascot } from '@/components/Mascot'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { cn } from '@/lib/cn'
import { termRank } from '@/lib/term'
import { supabase } from '@/lib/supabase'
import { EditProfileModal } from './EditProfileModal'
import { ScheduleAccess } from './ScheduleAccess'
import { usePublicProfile, type PublicBlueprint, type PublicCourse, type PublicProfile } from './usePublicProfile'
import { badgeForPerson } from './badges'
import { ProfileHeader, ProfileTabs } from './ProfileHeader'
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
  const { loading, notFound, profile, courses, blueprints, reload } = usePublicProfile(handle)
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

  return (
    <>
      {!embedded && <ProfileMeta handle={handle} profile={profile} />}
      <div className={cn(!embedded && 'mx-auto w-full max-w-3xl px-5 py-5 sm:px-6')}>
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
          <div className="grid place-items-center py-24">
            <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
          </div>
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
                    { id: 'classes', label: 'Classes', icon: BookOpen, count: courses.length },
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

                {tab === 'classes' &&
                  (courses.length > 0 ? (
                    <div className="pt-4">
                      <CoursesByTerm courses={courses} />
                    </div>
                  ) : (
                    <TabEmpty>
                      {!profile.coursesPublic
                        ? 'This profile keeps its class list private.'
                        : viewer === 'self'
                          ? 'Your class list is public but empty. Anything you add shows up here.'
                          : 'No classes shared.'}
                    </TabEmpty>
                  ))}

                {viewer === 'self' && (
                  <OwnerPrompts
                    coursesPublic={profile.coursesPublic}
                    hasCourses={courses.length > 0}
                    hasBlueprints={blueprints.length > 0}
                    onEdit={() => setEditing(true)}
                    onChanged={reload}
                  />
                )}
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

/**
 * Courses grouped by term, newest first.
 *
 * A flat two-column grid of every class anyone ever took reads as a wall: by
 * third year it is thirty identical rows with the term repeated on each one.
 * Grouping puts the term where it belongs — once, as a heading — and makes the
 * shape of someone's degree legible at a glance, which is the only reason to
 * look at this list at all.
 */
function CoursesByTerm({ courses }: { courses: PublicCourse[] }) {
  const groups = new Map<string, PublicCourse[]>()
  for (const c of courses) {
    const key = c.term || 'Other'
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }
  const terms = [...groups.keys()].sort((a, b) => termRank(b) - termRank(a))

  return (
    <div className="space-y-4">
      {terms.map((term) => (
        <div key={term}>
          <p className="mb-1.5 flex items-baseline gap-2 text-[11.5px] font-semibold tracking-wide text-subtle uppercase">
            {term}
            <span className="font-normal normal-case">
              {groups.get(term)!.length} class{groups.get(term)!.length === 1 ? '' : 'es'}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {groups.get(term)!.map((c, i) => (
              <span
                key={`${c.code}-${i}`}
                title={c.title}
                className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5"
              >
                <CourseChip code={c.code} color={c.color} />
                <span className="min-w-0 truncate text-[12.5px] text-muted">{c.title}</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
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

/**
 * What the owner can do about an empty profile.
 *
 * Only ever shown to the person who can act on it. A visitor reading "turn on
 * your class list" would be reading someone else's to-do list.
 */
function OwnerPrompts({
  coursesPublic,
  hasCourses,
  hasBlueprints,
  onEdit,
  onChanged,
}: {
  coursesPublic: boolean
  hasCourses: boolean
  hasBlueprints: boolean
  onEdit: () => void
  onChanged: () => void
}) {
  return (
    <div className="mt-6 space-y-2 border-t border-border pt-5">
      <p className="text-[11px] font-semibold tracking-wide text-subtle uppercase">Fill this out</p>

      {/* A switch, not a link. "Show your classes" is a yes/no you own, and
          sending someone to a settings panel to flip one boolean — then back
          here to see what it did — is three screens for one decision. The
          rows that genuinely need a form still navigate. */}
      <SwitchRow
        checked={coursesPublic}
        title="Show your classes"
        body="Code, title and term only — never a grade."
        onChange={(v) => void writeProfile({ courses_public: v }).then(onChanged)}
      />

      {coursesPublic && !hasCourses && (
        <PromptRow
          to="/app/courses"
          title="Add a class"
          body="Your class list is public but empty. Anything you add shows up here."
        />
      )}
      {!hasBlueprints && (
        <PromptRow
          to="/app/courses/blueprints"
          title="Upload an outline"
          body="Share a syllabus and the next student in your section imports it in one click."
        />
      )}
      <PromptRow
        onClick={onEdit}
        title="Add your links"
        body="Instagram, LinkedIn, X or a site — they show under your bio."
      />
    </div>
  )
}

/** One profile column, written straight. Swallows failures for the same reason
 *  the settings panel does: an unrun migration should cost a toggle, not the
 *  page. */
async function writeProfile(patch: Record<string, unknown>): Promise<void> {
  const { data } = await supabase.auth.getUser()
  if (!data.user) return
  await supabase.from('user_profile').update(patch).eq('user_id', data.user.id)
}

/** A "Fill this out" row that IS the setting. Optimistic: the switch moves on
 *  the tap and the page re-reads after the write, so it never sits dead while
 *  a round trip happens. */
function SwitchRow({
  checked,
  title,
  body,
  onChange,
}: {
  checked: boolean
  title: string
  body: string
  onChange: (next: boolean) => void
}) {
  const [on, setOn] = useState(checked)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        <span className="block text-[11.5px] leading-relaxed text-subtle">{body}</span>
      </span>
      <Switch
        checked={on}
        label={title}
        onChange={(v) => {
          setOn(v)
          onChange(v)
        }}
      />
    </div>
  )
}

/** One suggestion: a link, or a button that opens the profile editor. */
function PromptRow({
  to,
  onClick,
  title,
  body,
}: {
  to?: string
  onClick?: () => void
  title: string
  body: string
}) {
  const style =
    'flex w-full items-start gap-3 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left transition-colors duration-150 hover:border-accent'
  const inner = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        <span className="block text-[11.5px] leading-relaxed text-subtle">{body}</span>
      </span>
      <ChevronRight size={15} className="mt-0.5 shrink-0 text-subtle" aria-hidden />
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={style}>
        {inner}
      </button>
    )
  }
  return (
    <Link to={to as string} className={style}>
      {inner}
    </Link>
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
