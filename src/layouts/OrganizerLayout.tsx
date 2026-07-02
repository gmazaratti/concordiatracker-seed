import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  LogOut,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { StatusChip } from './TeacherLayout'
import { OrgLogo } from '@/features/community/OrgLogo'
import { cn } from '@/lib/cn'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/organizer', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/organizer/events', label: 'Events', icon: CalendarDays, end: false },
  { to: '/organizer/insights', label: 'Insights', icon: BarChart3, end: false },
  { to: '/organizer/profile', label: 'Profile', icon: UserCircle, end: false },
  { to: '/organizer/team', label: 'Team', icon: Users, end: false },
]

/**
 * The organizer portal's app shell — a real sidebar layout (like the student
 * app) instead of the plain top-bar dashboard: desktop left rail with the org
 * identity + five destinations, mobile top bar + bottom nav. Signed out (or on
 * the invite/join/request pages) it falls back to a slim top-bar chrome.
 */
export function OrganizerLayout() {
  const { currentOrg, signOut, isDemoSession } = useTeacher()
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  // Signed out → slim chrome (sign-in, invite-accept, join, request pages).
  if (!currentOrg) {
    return (
      <div className="flex min-h-svh flex-col bg-canvas">
        <header className="border-b border-border bg-surface/40">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
            <Link to="/organizer" className="flex items-center gap-2 text-[14px] font-medium text-fg">
              <CalendarDays size={18} className="text-accent" aria-hidden />
              ConcordiaTracker
              <span className="hidden text-subtle sm:inline">· Organizer portal</span>
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

  return (
    <div className="flex h-svh overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 p-3 md:flex">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-3">
          <OrgLogo org={currentOrg.org} className="size-10" rounded="rounded-xl" textClass="text-[14px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-fg">{currentOrg.org.name}</p>
            <p className="truncate text-[11.5px] text-subtle">{currentOrg.org.handle}</p>
          </div>
        </div>
        <div className="mb-2 px-2">
          <StatusChip status={currentOrg.status} />
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-accent-soft font-medium text-fg'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={cn(
                      'transition-colors duration-150',
                      isActive ? 'text-accent' : 'text-subtle group-hover:text-muted',
                    )}
                    aria-hidden
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-1 border-t border-border pt-2">
          <Link
            to="/app"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <CalendarDays size={18} className="text-subtle" aria-hidden />
            Back to the app
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <LogOut size={18} className="text-subtle" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 pb-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <OrgLogo org={currentOrg.org} className="size-8" rounded="rounded-lg" textClass="text-[12px]" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-fg">{currentOrg.org.name}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusChip status={currentOrg.status} />
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </header>

        {isDemoSession && (
          <div className="border-b border-warning/30 bg-warning/10">
            <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-5 py-2 text-[12px] text-warning">
              <FlaskConical size={14} className="shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold">Demo mode.</strong> You're exploring a sample
                portal — nothing you do here is saved or affects the real site.
              </span>
              <button
                type="button"
                onClick={signOut}
                className="ml-auto shrink-0 font-medium underline underline-offset-2"
              >
                Exit demo
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {/* Mobile bottom nav — in-flow (not fixed), same pattern as the student app */}
        <nav className="flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-150',
                  isActive ? 'text-accent' : 'text-subtle',
                )
              }
            >
              <Icon size={19} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
