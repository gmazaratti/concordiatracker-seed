import { Link, NavLink, Outlet, useMatch, useSearchParams } from 'react-router-dom'
import { BookOpen, FlaskConical, GraduationCap, LayoutDashboard, Loader2, LogOut } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { useAppData } from '@/app/providers/app-data'
import { TEACHER_SECTIONS, type PortalRole } from '@/data/teacher'
import { cn } from '@/lib/cn'

/**
 * Teacher portal shell — a real left-sidebar app (matching the organizer portal
 * + admin console) instead of a plain top bar: identity + status, a Dashboard
 * link, and the teacher's courses as quick-nav to each workspace. Signed out (or
 * on the invite/request pages) it falls back to slim top-bar chrome.
 *
 * The `role` prop is kept for the router's API; the organizer role has its own
 * OrganizerLayout, so this shell is teacher-focused.
 */
export function PortalLayout({ role }: { role: PortalRole }) {
  const { currentTeacher, signOut, isDemoSession } = useTeacher()
  const { loading } = useAuth()
  const { user } = useAppData()
  const portalLabel = role === 'organizer' ? 'Organizer portal' : 'Teacher portal'
  // Which course + sub-section is open (to expand the sidebar sub-tabs).
  const courseMatch = useMatch('/teacher/course/:courseId')
  const activeCourseId = courseMatch?.params.courseId
  const [searchParams] = useSearchParams()
  const activeSection = TEACHER_SECTIONS.find((s) => s.id === searchParams.get('section'))?.id ?? 'assignments'

  if (loading) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  // Signed out → slim chrome (the sign-in / invite / request pages).
  if (!currentTeacher) {
    return (
      <div className="flex min-h-svh flex-col bg-canvas">
        <header className="border-b border-border bg-surface/40">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
            <Link to="/teacher" className="flex items-center gap-2 text-[14px] font-medium text-fg">
              <GraduationCap size={18} className="text-accent" aria-hidden />
              ConcordiaTracker
              <span className="hidden text-subtle sm:inline">· {portalLabel}</span>
            </Link>
            <Link
              to="/"
              className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              Exit
            </Link>
          </div>
        </header>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    )
  }

  const courses = currentTeacher.courses

  return (
    <div className="flex h-svh overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 p-3 md:flex">
        {/* Identity + status, grouped above a divider that separates it from nav */}
        <div className="mb-3 border-b border-border pb-3">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
              <GraduationCap size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold text-fg">{currentTeacher.name}</p>
              <p className="truncate text-[11.5px] text-subtle">{portalLabel}</p>
            </div>
          </div>
          <div className="mt-1.5 px-2">
            <StatusChip status={currentTeacher.status} />
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <NavLink
            to="/teacher"
            end
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                isActive ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            {({ isActive }) => (
              <>
                <LayoutDashboard size={18} className={cn(isActive ? 'text-accent' : 'text-subtle group-hover:text-muted')} aria-hidden />
                Dashboard
              </>
            )}
          </NavLink>

          {courses.length > 0 && (
            <>
              <p className="mt-3 px-3 pb-1 text-[10.5px] font-medium tracking-wide text-subtle uppercase">Your courses</p>
              {courses.map((c) => {
                const activeCourse = c.courseId === activeCourseId
                return (
                  <div key={c.courseId}>
                    <NavLink
                      to={`/teacher/course/${c.courseId}`}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                          isActive ? 'font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <BookOpen size={17} className={cn('shrink-0', isActive ? 'text-accent' : 'text-subtle group-hover:text-muted')} aria-hidden />
                          <span className="min-w-0 flex-1 truncate">
                            {c.code || 'Untitled'}
                            {c.section ? ` · ${c.section}` : ''}
                          </span>
                          {c.published && <span className="size-1.5 shrink-0 rounded-full bg-success" title="Published" aria-hidden />}
                        </>
                      )}
                    </NavLink>

                    {/* Sub-tabs, indented under the open course */}
                    {activeCourse && (
                      <div className="mt-0.5 mb-1 ml-[1.35rem] flex flex-col gap-0.5 border-l border-border pl-2">
                        {TEACHER_SECTIONS.map((s) => (
                          <Link
                            key={s.id}
                            to={`/teacher/course/${c.courseId}?section=${s.id}`}
                            className={cn(
                              'rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors duration-150',
                              activeSection === s.id ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                            )}
                          >
                            {s.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          )}
        </nav>

        <div className="flex-1" />

        {/* Signed-in user + exits */}
        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="size-8 shrink-0 rounded-full bg-surface-2 object-cover" />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">{user.initials}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-fg">{user.name}</p>
              <p className="truncate text-[11px] text-subtle">{user.email}</p>
            </div>
          </div>
          <Link to="/app" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
            <GraduationCap size={18} className="text-subtle" aria-hidden />
            Back to the app
          </Link>
          <button type="button" onClick={signOut} className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
            <LogOut size={18} className="text-subtle" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] md:hidden">
          <Link to="/teacher" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
              <GraduationCap size={16} aria-hidden />
            </span>
            <span className="truncate text-[13.5px] font-semibold text-fg">{currentTeacher.name}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <StatusChip status={currentTeacher.status} />
            <button type="button" onClick={signOut} aria-label="Sign out" className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg">
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </header>

        {isDemoSession && (
          <div className="border-b border-warning/30 bg-warning/10">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-5 py-2 text-[12px] text-warning">
              <FlaskConical size={14} className="shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">Demo mode.</strong> You're exploring a sample portal —
                nothing you do here is saved or affects the real site.
              </span>
              <button type="button" onClick={signOut} className="ml-auto shrink-0 font-medium underline underline-offset-2">
                Exit demo
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function StatusChip({ status }: { status: 'pending' | 'approved' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        status === 'approved' ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning',
      )}
    >
      {status === 'approved' ? 'Approved' : 'Pending approval'}
    </span>
  )
}
