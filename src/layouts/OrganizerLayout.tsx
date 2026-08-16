import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronsUpDown,
  FlaskConical,
  LayoutDashboard,
  Loader2,
  LogOut,
  UserCircle,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { OrgAccount } from '@/data/teacher'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { useAppData } from '@/app/providers/app-data'
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
  const { currentOrg, myOrgs, switchOrg, signOut, isDemoSession, orgViewerPerms } = useTeacher()
  const { loading } = useAuth()
  const { user } = useAppData()
  // Sidebar honours your permissions: no Insights without view_insights, no
  // Profile editor without edit_profile (RLS enforces the same server-side).
  const nav = NAV.filter((item) => {
    if (item.to === '/organizer/insights') return orgViewerPerms.view_insights
    if (item.to === '/organizer/profile') return orgViewerPerms.edit_profile
    return true
  })

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
        {/* Org identity + switcher + status, grouped above a divider that clearly
            separates it from the nav below. */}
        <div className="mb-3 border-b border-border pb-3">
          <OrgSwitcher orgs={myOrgs} current={currentOrg} onSwitch={switchOrg} />
          <div className="mt-1.5 px-2">
            <StatusChip status={currentOrg.status} />
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
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
          {/* Who's signed in (distinct from the org above) */}
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-8 shrink-0 rounded-full bg-surface-2 object-cover"
              />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                {user.initials}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium text-fg">{user.name}</p>
              <p className="truncate text-[11px] text-subtle">{user.email}</p>
            </div>
          </div>
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
                portal: nothing you do here is saved or affects the real site.
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

        {/* Mobile bottom nav: in-flow (not fixed), same pattern as the student app */}
        <nav className="flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
          {nav.map(({ to, label, icon: Icon, end }) => (
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

/** The org identity block — a plain header when you manage one org, a dropdown
 * switcher when you manage several (owned + member-of + all, if you're an admin).
 * Switching re-points every organizer screen at the newly-selected org. */
function OrgSwitcher({
  orgs,
  current,
  onSwitch,
}: {
  orgs: OrgAccount[]
  current: OrgAccount
  onSwitch: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const multi = orgs.length > 1

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={!multi}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup={multi ? 'menu' : undefined}
        aria-expanded={multi ? open : undefined}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors duration-150',
          multi ? 'hover:bg-surface-2' : 'cursor-default',
        )}
      >
        <OrgLogo org={current.org} className="size-10" rounded="rounded-xl" textClass="text-[14px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-fg">{current.org.name}</p>
          <p className="truncate text-[11.5px] text-subtle">{current.org.handle}</p>
        </div>
        {multi && <ChevronsUpDown size={15} className="shrink-0 text-subtle" aria-hidden />}
      </button>

      {open && multi && (
        <div
          role="menu"
          className="ct-animate-pop absolute inset-x-0 top-full z-40 mt-1 max-h-[19rem] overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl"
        >
          <p className="px-2 py-1 text-[10.5px] font-medium tracking-wide text-subtle uppercase">
            Switch organization
          </p>
          {orgs.map((o) => {
            const active = o.id === current.id
            return (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  if (!active) onSwitch(o.id)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-surface-2',
                  active && 'bg-surface-2',
                )}
              >
                <OrgLogo org={o.org} className="size-7" rounded="rounded-lg" textClass="text-[11px]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-fg">{o.org.name}</p>
                  <p className="truncate text-[11px] text-subtle">{o.org.handle}</p>
                </div>
                {active && <Check size={14} className="shrink-0 text-accent" aria-hidden />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
