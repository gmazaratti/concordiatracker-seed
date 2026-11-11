import { NavLink, Link } from 'react-router-dom'
import { CalendarDays, Eye, House, LayoutGrid, LogOut, type LucideIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/app/providers/auth'
import { cn } from '@/lib/cn'
import type { GuardedStudent } from '@/lib/guardians'

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/family', label: 'Today', icon: House, end: true },
  { to: '/family/courses', label: 'Courses', icon: LayoutGrid },
  { to: '/family/calendar', label: 'Calendar', icon: CalendarDays },
]

/**
 * The family view's frame: the app's own sidebar and phone bar, cut down to
 * the three places a parent can look (Today, Courses, Calendar). No Planner,
 * no Social, no Settings, no search: those are the student's. A parent who
 * also studies here gets a way back to their own app.
 */
export function FamilyShell({
  students,
  current,
  pick,
  children,
}: {
  students: GuardedStudent[]
  current: GuardedStudent | null
  pick: (id: string) => void
  children: React.ReactNode
}) {
  const { signOut } = useAuth()
  const q = current ? `?student=${current.student}` : ''
  const initials = (current?.name ?? '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="flex h-[100dvh] bg-canvas text-fg">
      <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r border-border bg-surface/40 p-3 md:flex">
        <div className="flex items-center justify-between px-2 pt-1 pb-3">
          <Logo />
        </div>

        {/* Whose view this is. With more than one student, a switcher. */}
        <div className="mb-2 rounded-xl border border-border bg-surface px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-subtle uppercase">
            <Eye size={12} aria-hidden /> Family view
          </p>
          <div className="relative mt-1.5 flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{initials}</span>
            {students.length > 1 ? (
              <div className="min-w-0 flex-1">
                <Select
                  value={current?.student ?? ''}
                  onChange={pick}
                  ariaLabel="Student"
                  size="sm"
                  options={students.map((s) => ({ value: s.student, label: s.name }))}
                />
              </div>
            ) : (
              <span className="truncate text-[14px] font-semibold text-fg">{current?.name}</span>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to + q}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
                  isActive ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={cn('shrink-0', isActive ? 'text-accent' : 'text-subtle group-hover:text-muted')} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="flex-1" />
        <Link to="/app" className="rounded-lg px-3 py-2 text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg">
          Open my own ConcordiaTracker
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
        >
          <LogOut size={15} aria-hidden /> Sign out
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone: a slim top bar with whose view this is, the tabs at the bottom. */}
        <header className="flex items-center gap-2 border-b border-border px-4 pt-[calc(env(safe-area-inset-top)+10px)] pb-2.5 md:hidden">
          <Logo />
          <span className="ml-auto flex min-w-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
            <Eye size={12} className="shrink-0" aria-hidden />
            <span className="truncate">{current?.name}</span>
          </span>
          <Link to="/app" className="shrink-0 text-[12px] text-subtle">
            My app
          </Link>
        </header>

        <main id="app-main" className="min-h-0 flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to + q}
              end={end}
              className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]', isActive ? 'text-accent' : 'text-subtle')}
            >
              <Icon size={20} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
