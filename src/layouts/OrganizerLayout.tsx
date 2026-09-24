import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, CalendarDays, Check, ChevronsUpDown, FlaskConical, Handshake, History, Inbox, LayoutDashboard, Loader2, LogOut, Newspaper, ShieldCheck, UserCircle, Users, type LucideIcon } from 'lucide-react'
import type { OrgAccount } from '@/data/teacher'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import { useAppData } from '@/app/providers/app-data'
import { StatusChip } from './TeacherLayout'
import { OrgLogo } from '@/features/community/OrgLogo'
import { WriteErrorToast } from '@/components/WriteErrorToast'
import { MemberPanelProvider } from '@/features/organizer/member-panel/MemberPanelProvider'
import { OrgBell } from '@/features/organizer/OrgNotifications'
import { MobilePortalNav } from '@/features/organizer/MobilePortalNav'
import { cn } from '@/lib/cn'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/organizer', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/organizer/events', label: 'Events', icon: CalendarDays, end: false },
  // Two kinds of publishing, two places: an event is dated and goes on a
  // calendar, a post is a moment and goes in a river.
  { to: '/organizer/feed', label: 'Feed', icon: Newspaper, end: false },
  { to: '/organizer/inbox', label: 'Inbox', icon: Inbox, end: false },
  // Next to Inbox on purpose: both are somebody else asking for something.
  { to: '/organizer/collabs', label: 'Collabs', icon: Handshake, end: false },
  { to: '/organizer/insights', label: 'Insights', icon: BarChart3, end: false },
  { to: '/organizer/profile', label: 'Profile', icon: UserCircle, end: false },
  { to: '/organizer/team', label: 'Team', icon: Users, end: false },
  // Next to Team because they are one job: who is here, and what they may do.
  { to: '/organizer/roles', label: 'Roles', icon: ShieldCheck, end: false },
  { to: '/organizer/activity', label: 'Activity', icon: History, end: false },
]

/**
 * The organizer portal's app shell — a real sidebar layout (like the student
 * app) instead of the plain top-bar dashboard: desktop left rail with the org
 * identity + five destinations, mobile top bar + bottom nav. Signed out (or on
 * the invite/join/request pages) it falls back to a slim top-bar chrome.
 */
export function OrganizerLayout() {
  const { currentOrg, myOrgs, switchOrg, signOut: endSession, isDemoSession, orgViewerPerms, orgsLoading } = useTeacher()
  const { loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Leaving the portal lands on its door, not on whatever page you were on —
  // which without a session is an empty shell.
  const signOut = () => {
    endSession()
    navigate('/organizer', { replace: true })
  }
  const { user } = useAppData()
  // Sidebar honours your permissions: no Insights without view_insights, no
  // Profile editor without edit_profile (RLS enforces the same server-side).
  const nav = NAV.filter((item) => {
    if (item.to === '/organizer/insights') return orgViewerPerms.view_insights
    if (item.to === '/organizer/profile') return orgViewerPerms.edit_profile
    // Roles is for people who can hand them out. Activity has its own
    // per-role switch, checked server-side, so the tab stays and the page
    // says plainly when it is not for you.
    if (item.to === '/organizer/roles') return orgViewerPerms.manage_team
    return true
  })

  // Pages that make sense without a club: the door itself, and the links
  // people are sent (an invite, a team invite, the access request, the
  // club application).
  // `/join/<token>` is the SHORT invite link — the one that actually gets
  // sent. It was missing here, so a fresh account opening it was redirected
  // to the portal's sign-in door and the invite was lost.
  const openPath =
    pathname === '/organizer' ||
    pathname === '/organizer/' ||
    /^\/organizer\/(invite|join|request|setup|apply)(\/|$)/.test(pathname) ||
    /^\/join\/[^/]+/.test(pathname)

  if (loading || (!currentOrg && !openPath && orgsLoading)) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  // Signed out → slim chrome (sign-in, invite-accept, join, request pages).
  if (!currentOrg) {
    // Anything else needs a club; without one it rendered an empty shell.
    if (!openPath) return <Navigate to="/organizer" replace />
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
          <WriteErrorToast />
        </main>
      </div>
    )
  }

  return (
    <MemberPanelProvider>
    <div className="flex h-svh overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface/40 p-3 md:flex">
        {/* Org identity + switcher + status, grouped above a divider that clearly
            separates it from the nav below. */}
        <div className="mb-3 border-b border-border pb-3">
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <OrgSwitcher orgs={myOrgs} current={currentOrg} onSwitch={switchOrg} />
            </div>
            <OrgBell orgId={currentOrg.id} />
          </div>
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
          {/* The same switcher as the desktop rail: somebody who runs two
              clubs used to have to sign in to each separately on a phone. */}
          <div className="min-w-0 flex-1">
            <OrgSwitcher orgs={myOrgs} current={currentOrg} onSwitch={switchOrg} compact />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <StatusChip status={currentOrg.status} />
            <OrgBell orgId={currentOrg.id} />
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
          <WriteErrorToast />
        </main>

        {/* MOBILE NAV: A SCROLLING STRIP, NOT SIX EQUAL SLOTS.
            The student bar divides the width between a fixed handful of
            DESTINATIONS and truncates the labels to keep its height stable.
            This is a dashboard's section list and it is now ten items long —
            at 375px that is 37px each, which ran "Collabs" into "Insights".
            So each item keeps the width its own label needs and the strip
            scrolls inside itself; `overflow-x-auto` on the nav means the PAGE
            still never scrolls sideways, the same answer the Planner tab strip
            landed on. */}
        <MobilePortalNav items={nav} />
      </div>
    </div>
    </MemberPanelProvider>
  )
}

/** The org identity block — a plain header when you manage one org, a dropdown
 * switcher when you manage several (owned + member-of + all, if you're an admin).
 * Switching re-points every organizer screen at the newly-selected org. */
function OrgSwitcher({
  orgs,
  current,
  onSwitch,
  compact,
}: {
  orgs: OrgAccount[]
  current: OrgAccount
  onSwitch: (id: string) => void
  /** The phone's top bar: a smaller face, and a menu as wide as the screen. */
  compact?: boolean
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
          'flex w-full items-center gap-2.5 rounded-xl text-left transition-colors duration-150',
          compact ? '-ml-1 px-1 py-1' : 'px-2 py-2',
          multi ? 'hover:bg-surface-2' : 'cursor-default',
        )}
      >
        <OrgLogo
          org={current.org}
          className={compact ? 'size-8' : 'size-10'}
          rounded={compact ? 'rounded-lg' : 'rounded-xl'}
          textClass={compact ? 'text-[12px]' : 'text-[14px]'}
        />
        <div className="min-w-0 flex-1">
          <p className={cn('truncate font-semibold text-fg', compact ? 'text-[13.5px]' : 'text-[14px]')}>{current.org.name}</p>
          <p className={cn('truncate text-subtle', compact ? 'text-[11px]' : 'text-[11.5px]')}>
            {compact && multi ? `${orgs.length} clubs · tap to switch` : current.org.handle}
          </p>
        </div>
        {multi && <ChevronsUpDown size={15} className="shrink-0 text-subtle" aria-hidden />}
      </button>

      {open && multi && (
        <div
          role="menu"
          className={cn(
            'ct-animate-pop absolute top-full z-40 mt-1 max-h-[19rem] overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-2xl',
            compact ? 'left-0 w-[calc(100vw-2rem)] max-w-sm' : 'inset-x-0',
          )}
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
