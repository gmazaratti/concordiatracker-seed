import { Link, useParams } from 'react-router-dom'
import { BookOpen, Download, FileText, GraduationCap, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { CourseChip } from '@/components/CourseChip'
import { NotFoundPage } from '@/features/NotFoundPage'
import { usePageMeta } from '@/app/hooks/usePageMeta'
import { programById } from '@/data/programs'
import { cn } from '@/lib/cn'
import { usePublicProfile, type PublicBlueprint, type PublicCourse, type PublicProfile } from './usePublicProfile'

/**
 * Public user profile at `/@handle` — viewable by ANYONE (anon included). The
 * page can only show what the SECURITY DEFINER RPCs return: a public profile's
 * name / avatar / program / bio + courses + blueprints, or — for a private
 * profile — just the handle and a lock. Lives outside the student app shell.
 */
export function UserProfilePage() {
  const { handle: raw } = useParams()
  // The route param includes the leading "@" (e.g. "@john"). Anything without it
  // isn't a profile URL → render the 404 in place (a redirect would just
  // re-match this dynamic route and bounce).
  if (!raw || !raw.startsWith('@')) return <NotFoundPage />
  const handle = raw.slice(1)
  // Key by handle so navigating between profiles remounts with fresh state.
  return <ProfileView key={handle} handle={handle} />
}

function ProfileView({ handle }: { handle: string }) {
  const { loading, notFound, profile, courses, blueprints } = usePublicProfile(handle)
  const prog = profile?.programId ? programById(profile.programId) : undefined

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
            {/* Identity header — same language as org profiles. */}
            <div className="h-40 overflow-hidden rounded-2xl sm:h-52" style={bannerStyle(handle)} />
            <div className="px-1">
              <Avatar profile={profile} />
              <div className="mt-2">
                {profile.isPublic && profile.name && (
                  <h1 className="font-display text-[22px] leading-tight font-semibold text-fg">{profile.name}</h1>
                )}
                <p className="text-[14px] text-subtle">@{profile.handle}</p>

                {profile.isPublic ? (
                  <>
                    {profile.program && (
                      <p className="mt-2 inline-flex items-center gap-1.5 text-[14px] text-fg">
                        <GraduationCap size={15} className="text-accent" aria-hidden />
                        {profile.program}
                        {prog && <span className="text-subtle">· {prog.credential}</span>}
                      </p>
                    )}
                    {profile.bio && <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-fg/90">{profile.bio}</p>}
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
                <Section icon={BookOpen} title="Courses" count={courses.length}>
                  {courses.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {courses.map((c, i) => (
                        <CourseRow key={`${c.code}-${i}`} course={c} />
                      ))}
                    </div>
                  ) : (
                    <Empty>No courses shared yet.</Empty>
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
    </div>
  )
}

function Avatar({ profile }: { profile: PublicProfile }) {
  const base = '-mt-12 grid size-24 place-items-center rounded-full ring-4 ring-canvas sm:-mt-14 sm:size-28'
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

function CourseRow({ course }: { course: PublicCourse }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2.5">
      <CourseChip code={course.code} color={course.color} />
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{course.title}</span>
      <span className="shrink-0 text-[11px] text-subtle">{course.term}</span>
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
