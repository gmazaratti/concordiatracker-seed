import { Link, Outlet, useLocation } from 'react-router-dom'
import { CalendarDays, FlaskConical, GraduationCap, LayoutDashboard, Loader2, LogOut, UserCircle, Users } from 'lucide-react'
import { useTeacher } from '@/app/providers/teacher'
import { useAuth } from '@/app/providers/auth'
import type { PortalRole } from '@/data/teacher'
import { cn } from '@/lib/cn'

/**
 * Distinct chrome for the portal — a plain top-bar "dashboard" (no student
 * sidebar or command palette), so it reads as a separate context for a different
 * audience. ONE shell, two roles: teachers manage course outlines, organizers
 * manage Community events; the role only swaps the labels, icon, and nav.
 */
export function PortalLayout({ role }: { role: PortalRole }) {
  const { currentTeacher, currentOrg, signOut, isDemoSession } = useTeacher()
  const { loading } = useAuth()
  const { pathname } = useLocation()

  // No hard login gate: the DEMO is public (look around without an account). Real
  // accounts sign in with Google on the sign-in screen; demo writes nothing real.
  if (loading) {
    return (
      <div className="grid h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  const isOrg = role === 'organizer'
  const base = isOrg ? '/organizer' : '/teacher'

  const account = isOrg ? currentOrg : currentTeacher
  const accountName = isOrg ? currentOrg?.org.name : currentTeacher?.name
  const BrandIcon = isOrg ? CalendarDays : GraduationCap

  const nav = isOrg
    ? [
        { to: '/organizer', label: 'Dashboard', icon: LayoutDashboard, exact: true },
        { to: '/organizer/profile', label: 'Profile', icon: UserCircle },
        { to: '/organizer/team', label: 'Team', icon: Users },
      ]
    : []

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="border-b border-border bg-surface/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Link to={base} className="flex items-center gap-2 text-[14px] font-medium text-fg">
            <BrandIcon size={18} className="text-accent" aria-hidden />
            ConcordiaTracker
            <span className="hidden text-subtle sm:inline">
              · {isOrg ? 'Organizer portal' : 'Teacher portal'}
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {account &&
              nav.map((item) => {
                const Icon = item.icon
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors duration-150',
                      active
                        ? 'bg-accent-soft text-accent'
                        : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    <Icon size={14} aria-hidden />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Link>
                )
              })}

            {account ? (
              <>
                <span className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
                  <span className="max-w-[180px] truncate text-[13px] font-medium text-fg">
                    {accountName}
                  </span>
                  <StatusChip status={account.status} />
                </span>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
                >
                  <LogOut size={14} aria-hidden />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              </>
            ) : (
              <Link
                to="/"
                className="rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
              >
                Exit
              </Link>
            )}
          </div>
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

      <main className="flex-1">
        <Outlet />
      </main>
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
