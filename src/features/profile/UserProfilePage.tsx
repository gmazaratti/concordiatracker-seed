import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  BookOpen,
  CalendarRange,
  Download,
  FileText,
  GraduationCap,
  Loader2,
  Lock,
  Pencil,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { CourseChip } from '@/components/CourseChip'
import { NotFoundPage } from '@/features/NotFoundPage'
import { HANDLE_RE } from '@/features/onboarding/handle'
import { Mascot } from '@/components/Mascot'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { programById } from '@/data/programs'
import { cn } from '@/lib/cn'
import { termRank } from '@/lib/term'
import { supabase } from '@/lib/supabase'
import {
  canSeeSchedule,
  friendSchedule,
  linkHref,
  type Friend,
  type FriendCourse,
  type ProfileLinks,
} from '@/lib/social'
import { FriendButton } from './FriendButton'
import { MessagesModal } from './Messages'
import { usePublicProfile, type PublicBlueprint, type PublicCourse, type PublicProfile } from './usePublicProfile'
import { founderFor, type FounderProfile } from './founders'
import { VerifiedBadge } from '@/features/community/VerifiedBadge'
import { SocialLinks, SocialFieldIcon } from '@/features/community/SocialLinks'

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
  return <ProfileView key={handle} handle={handle} />
}

function ProfileView({ handle }: { handle: string }) {
  const { loading, notFound, profile, courses, blueprints } = usePublicProfile(handle)
  const viewer = useViewer(handle)
  const [messaging, setMessaging] = useState<Friend | null>(null)
  const [showMessages, setShowMessages] = useState(false)
  const prog = profile?.programId ? programById(profile.programId) : undefined
  // Only applies to a real, closed set of handles — cosmetic, never a permission.
  const founder = profile?.isPublic ? founderFor(handle) : undefined

  usePageMeta({
    title:
      profile?.isPublic && profile.name
        ? `${profile.name} (@${profile.handle}) · ConcordiaTracker`
        : `@${handle} · ConcordiaTracker`,
    description:
      profile?.isPublic && profile.name
        ? `${profile.name}${profile.program ? ` · ${profile.program}` : ''} on ConcordiaTracker.`
        : undefined,
    path: `/@${handle}`,
    // Public profiles are indexable; private ones are not.
    robots: profile && !profile.isPublic ? 'noindex,follow' : 'index,follow',
  })

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

      <main className="mx-auto w-full max-w-3xl px-5 py-5 sm:px-6">
        {loading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
          </div>
        ) : notFound || !profile ? (
          <NotFound handle={handle} />
        ) : (
          <>
            {/* Identity header: same language as org profiles. */}
            <div
              className={cn(
                'h-40 overflow-hidden rounded-2xl sm:h-52',
                founder && 'ct-aurora',
              )}
              style={founder ? FOUNDER_BANNER : bannerStyle(handle)}
            />
            <div className="px-1">
              <Avatar profile={profile} founder={!!founder} />
              <div className="mt-2">
                {profile.isPublic && profile.name && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">
                      {profile.name}
                    </h1>
                    {founder && (
                      <>
                        <VerifiedBadge size={17} className="[filter:drop-shadow(0_0_4px_var(--ct-accent))]" />
                        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                          {founder.role}
                        </span>
                      </>
                    )}
                  </div>
                )}
                <p className="text-[14px] text-subtle">@{profile.handle}</p>

                {/* The controls belong HERE, on the thing they act on. Editing
                    your own profile only from Settings meant looking at it,
                    wanting to change it, and having to go somewhere else and
                    find the right section. */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {viewer === 'self' ? (
                    <>
                      <Link
                        to="/app?settings=account"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
                      >
                        <Pencil size={13} aria-hidden />
                        Edit profile
                      </Link>
                      <Link
                        to="/app?settings=privacy"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg"
                      >
                        <Lock size={13} aria-hidden />
                        Privacy
                      </Link>
                      <button
                        type="button"
                        onClick={() => setShowMessages(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-fg"
                      >
                        <Users size={13} aria-hidden />
                        Friends
                      </button>
                    </>
                  ) : viewer === 'other' ? (
                    <FriendButton handle={profile.handle} onMessage={(f) => setMessaging(f)} />
                  ) : null}
                </div>
                {founder?.tagline && (
                  <p className="mt-1.5 max-w-xl text-[14px] leading-relaxed text-fg/90">{founder.tagline}</p>
                )}

                {profile.isPublic ? (
                  <>
                    {profile.program && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] text-fg">
                        <GraduationCap size={15} className="text-accent" aria-hidden />
                        {profile.program}
                        {prog && <span className="text-subtle">· {prog.credential}</span>}
                      </p>
                    )}
                    {profile.bio && <p className="mt-3 max-w-2xl text-[14px] leading-relaxed whitespace-pre-line text-fg/90">{profile.bio}</p>}
                  </>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-[13px] text-subtle">
                    <Lock size={14} aria-hidden />
                    This profile is private.
                  </p>
                )}
              </div>
            </div>

            {profile.isPublic && (
              <>
                {founder?.links && <LinksDivider links={founder.links} />}
                <ProfileLinkRow links={profile.links} />
                <FriendSchedule handle={profile.handle} />
                <Section icon={BookOpen} title="Courses" count={courses.length}>
                  {courses.length > 0 ? (
                    <CoursesByTerm courses={courses} />
                  ) : (
                    <Empty>
                      {profile.coursesPublic
                        ? 'No courses shared yet.'
                        : 'This person keeps their class list private.'}
                    </Empty>
                  )}
                </Section>

                <Section icon={FileText} title="Uploaded blueprints" count={blueprints.length}>
                  {blueprints.length > 0 ? (
                    <ul className="space-y-2">
                      {blueprints.map((b) => (
                        <BlueprintRow key={b.id} bp={b} />
                      ))}
                    </ul>
                  ) : (
                    <Empty>No blueprints uploaded yet.</Empty>
                  )}
                </Section>
              </>
            )}
          </>
        )}
      </main>

      {(showMessages || messaging) && (
        <MessagesModal
          startWith={messaging ?? undefined}
          onClose={() => {
            setShowMessages(false)
            setMessaging(null)
          }}
        />
      )}
    </div>
  )
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

/** Whatever they linked, and nothing else. Every href is rebuilt from the
 *  platform's own base unless it is plainly http(s), so a pasted
 *  `javascript:` string can never become a link someone else clicks. */
function ProfileLinkRow({ links }: { links: ProfileLinks }) {
  const entries = (Object.keys(links) as (keyof ProfileLinks)[])
    .map((k) => ({ kind: k, value: links[k] as string, href: linkHref(k, links[k] as string) }))
    .filter((e) => e.href)
  if (entries.length === 0) return null
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {entries.map((e) => {
        return (
          <a
            key={e.kind}
            href={e.href as string}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] text-muted transition-colors duration-150 hover:border-accent hover:text-fg"
          >
            {/* The same hand-rolled brand glyphs the org profiles use — lucide
                dropped its brand icons over trademarks, and a second set here
                would drift from that one. */}
            <SocialFieldIcon field={e.kind} size={13} />
            {stripScheme(e.value)}
          </a>
        )
      })}
    </div>
  )
}

function stripScheme(v: string): string {
  return v.replace(/^https?:/, '').replace(/^\/\//, '').slice(0, 28)
}

/**
 * Their timetable, if they are your friend and they turned it on.
 *
 * The whole point of the feature: "when are your classes" gets asked constantly
 * and answered with a screenshot that goes stale. Renders nothing at all unless
 * the server says you may see it - and the server gives the same empty answer
 * whether you are not their friend or they switched it off, so this cannot be
 * used to probe someone's settings.
 *
 * Times and rooms only. Never a grade, not even for a friend.
 */
function FriendSchedule({ handle }: { handle: string }) {
  const [rows, setRows] = useState<FriendCourse[] | null>(null)
  useEffect(() => {
    let alive = true
    void canSeeSchedule(handle).then((ok) => {
      if (!alive || !ok) return
      void friendSchedule(handle).then((r) => alive && setRows(r))
    })
    return () => {
      alive = false
    }
  }, [handle])

  if (!rows || rows.length === 0) return null
  return (
    <Section icon={CalendarRange} title="Their schedule" count={rows.length}>
      <p className="mb-2 text-[11.5px] text-subtle">
        Shared with friends. Times and rooms only &mdash; never grades.
      </p>
      <ul className="space-y-1.5">
        {rows.map((c, i) => (
          <li
            key={`${c.code}-${i}`}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-lg border border-border bg-surface px-3 py-2"
          >
            <span className="text-[12.5px] font-semibold text-fg">{c.code}</span>
            <span className="min-w-0 flex-1 truncate text-[12px] text-muted">{c.title}</span>
            <span className="text-[11.5px] text-subtle">
              {c.meeting_times || 'No set time'}
              {c.location ? ` · ${c.location}` : ''}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Avatar({ profile, founder = false }: { profile: PublicProfile; founder?: boolean }) {
  const base = '-mt-12 grid size-24 place-items-center rounded-full ring-4 ring-canvas sm:-mt-14 sm:size-28'
  if (founder) return <FounderAvatar profile={profile} base={base} />
  if (!profile.isPublic) {
    return (
      <div className={cn(base, 'bg-surface-2 text-subtle')} aria-label="Private profile">
        <Lock size={34} aria-hidden />
      </div>
    )
  }
  if (profile.avatarUrl) {
    return (
      <img
        src={profile.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(base, 'bg-surface-2 object-cover')}
      />
    )
  }
  return (
    <div className={cn(base, 'bg-accent-soft text-2xl font-semibold text-accent')}>{initialsOf(profile.name)}</div>
  )
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

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof BookOpen
  title: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section className="mt-6 border-t border-border pt-5">
      <h2 className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
        <Icon size={13} aria-hidden />
        {title}
        <span className="text-subtle/70">· {count}</span>
      </h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border-strong bg-surface/50 px-5 py-6 text-center text-[13px] text-subtle">
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
const FOUNDER_BANNER: React.CSSProperties = {
  backgroundImage:
    'linear-gradient(120deg, var(--ct-accent), var(--ct-surface-2) 35%, var(--ct-accent) 55%, var(--ct-surface) 80%, var(--ct-accent))',
}

/** The founder avatar, wrapped in a soft pulsing halo. */
function FounderAvatar({ profile, base }: { profile: PublicProfile; base: string }) {
  return (
    <div className="relative inline-block">
      <span
        className="ct-halo pointer-events-none absolute -inset-2 rounded-full bg-accent blur-xl"
        aria-hidden
      />
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={cn(base, 'relative bg-surface-2 object-cover')}
        />
      ) : (
        <div className={cn(base, 'relative bg-accent-soft text-2xl font-semibold text-accent')}>
          {initialsOf(profile.name)}
        </div>
      )}
    </div>
  )
}

/** Social links sitting ON the rule above Courses — same treatment orgs get. */
function LinksDivider({ links }: { links: FounderProfile['links'] }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <SocialLinks links={links} className="flex shrink-0 gap-2" />
      <span className="h-px w-12 bg-border" aria-hidden />
    </div>
  )
}

function bannerStyle(handle: string): React.CSSProperties {
  let h = 0
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) % 360
  return { background: `linear-gradient(135deg, hsl(${h} 45% 42%), hsl(${(h + 42) % 360} 50% 28%))` }
}

function initialsOf(name?: string): string {
  return (
    (name ?? '')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  )
}
