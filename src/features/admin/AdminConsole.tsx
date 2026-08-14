import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  Bug,
  Building2,
  CalendarDays,
  ClipboardList,
  Compass,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Link2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useIsAdmin } from './admin-data'
import { AdminDashboardTab } from './tabs/AdminDashboardTab'
import { UsersTab } from './tabs/UsersTab'
import { ApplicationsTab } from './tabs/ApplicationsTab'
import { PortalsTab } from './tabs/PortalsTab'
import { VanityTab } from './tabs/VanityTab'
import { BugReportsTab } from './tabs/BugReportsTab'
import { AttributionTab } from './tabs/AttributionTab'
import { TrafficTab } from './tabs/TrafficTab'
import { SurveyResultsTab } from './tabs/SurveyResultsTab'
import { cn } from '@/lib/cn'

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'applications', label: 'Applications', icon: Inbox },
  { id: 'portals', label: 'Portals', icon: Building2 },
  { id: 'traffic', label: 'Traffic', icon: Activity },
  { id: 'attribution', label: 'Attribution', icon: Compass },
  { id: 'survey', label: 'Survey', icon: ClipboardList },
  { id: 'links', label: 'Links & Vanity', icon: Link2 },
  { id: 'bugs', label: 'Bug reports', icon: Bug },
] as const

type TabId = (typeof TABS)[number]['id']

/** Cross-context links so the admin can hop straight into the other portals. */
const PORTAL_LINKS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/teacher', label: 'Teacher portal', icon: GraduationCap },
  { to: '/organizer', label: 'Organizer portal', icon: CalendarDays },
]

/**
 * Standalone, admin-only console — now a left-sidebar app shell. Defense in
 * depth: the entry point (avatar menu) is hidden for non-admins, this page
 * renders "Not authorized" unless is_admin(), and every underlying RPC is gated
 * on is_admin() at the database.
 */
export function AdminConsole() {
  const { loading, isAdmin } = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const [menuOpen, setMenuOpen] = useState(false)

  const current = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'overview') as TabId
  const select = (id: TabId) => setParams((p) => { p.set('tab', id); return p }, { replace: true })

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === current)
    let next: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    select(TABS[next].id)
    refs.current[next]?.focus()
  }

  if (loading) {
    return (
      <div className="grid min-h-svh place-items-center bg-canvas">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="grid min-h-svh place-items-center bg-canvas">
        <div className="mx-auto w-full max-w-md px-5 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-xl bg-danger/10 text-danger">
            <ShieldAlert size={24} aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-[20px] font-semibold text-fg">Not authorized</h1>
          <p className="mt-1.5 text-[13px] text-subtle">The admin console is restricted to the platform administrator.</p>
          <Link to="/app" className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline">
            Back to app
          </Link>
        </div>
      </div>
    )
  }

  const body = (
    <div className="mx-auto w-full max-w-5xl px-5 py-6">
      <div role="tabpanel" id={`admin-panel-${current}`} aria-labelledby={`admin-tab-${current}`}>
        {current === 'overview' && <AdminDashboardTab />}
        {current === 'users' && <UsersTab />}
        {current === 'applications' && <ApplicationsTab />}
        {current === 'portals' && <PortalsTab />}
        {current === 'traffic' && <TrafficTab />}
        {current === 'attribution' && <AttributionTab />}
        {current === 'survey' && <SurveyResultsTab />}
        {current === 'links' && <VanityTab />}
        {current === 'bugs' && <BugReportsTab />}
      </div>
    </div>
  )

  return (
    <div className="flex h-svh overflow-hidden bg-canvas">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface/40 p-3 md:flex">
        <div className="flex items-center gap-2 px-2 py-3">
          <ShieldCheck size={18} className="text-accent" aria-hidden />
          <span className="text-[14px] font-semibold text-fg">ConcordiaTracker</span>
          <span className="text-[11px] text-subtle">Admin</span>
        </div>

        <nav role="tablist" aria-label="Admin sections" aria-orientation="vertical" onKeyDown={onKeyDown} className="mt-1 flex flex-col gap-0.5">
          {TABS.map((t, i) => {
            const Icon = t.icon
            const active = t.id === current
            return (
              <button
                key={t.id}
                ref={(el) => { refs.current[i] = el }}
                role="tab"
                id={`admin-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`admin-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => select(t.id)}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150',
                  active ? 'bg-accent-soft font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <Icon size={17} className={cn(active ? 'text-accent' : 'text-subtle group-hover:text-muted')} aria-hidden />
                {t.label}
              </button>
            )
          })}
        </nav>

        <div className="flex-1" />

        {/* Hop into the other portals + back to the app */}
        <div className="flex flex-col gap-0.5 border-t border-border pt-2">
          <p className="px-3 pb-1 text-[10.5px] font-medium tracking-wide text-subtle uppercase">Jump to</p>
          {PORTAL_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <Icon size={17} className="text-subtle" aria-hidden />
              {label}
            </Link>
          ))}
          <Link
            to="/app"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft size={17} className="text-subtle" aria-hidden />
            Back to app
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile chrome. A 9-item horizontal scroll strip hid most of the
            console off-screen with nothing signalling it scrolled, so mobile
            gets an explicit section picker instead: current section always
            visible, tap to see every option at once. */}
        <header className="sticky top-0 z-20 border-b border-border bg-canvas/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(0.75rem_+_env(safe-area-inset-top))]">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-fg">
              <ShieldCheck size={16} className="text-accent" aria-hidden /> Admin
            </span>
            <Link
              to="/app"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft size={13} aria-hidden /> App
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Choose a section"
            className="flex w-full items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-left"
          >
            <span className="flex items-center gap-2 text-[13.5px] font-semibold text-fg">
              {(() => {
                const Icon = TABS.find((t) => t.id === current)?.icon ?? LayoutDashboard
                return <Icon size={16} className="text-accent" aria-hidden />
              })()}
              {TABS.find((t) => t.id === current)?.label}
            </span>
            <ChevronDown
              size={17}
              className={cn('shrink-0 text-subtle transition-transform duration-200', menuOpen && 'rotate-180')}
              aria-hidden
            />
          </button>

          {menuOpen && (
            <div className="max-h-[60vh] overflow-y-auto border-t border-border bg-surface">
              <div role="tablist" aria-label="Admin sections" className="p-2">
                {TABS.map((t) => {
                  const Icon = t.icon
                  const active = t.id === current
                  return (
                    <button
                      key={t.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        select(t.id)
                        setMenuOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] transition-colors duration-150',
                        active ? 'bg-accent-soft font-semibold text-fg' : 'text-muted',
                      )}
                    >
                      <Icon size={17} className={active ? 'text-accent' : 'text-subtle'} aria-hidden />
                      {t.label}
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-border p-2">
                <p className="px-3 pb-1 text-[10.5px] font-medium tracking-wide text-subtle uppercase">
                  Jump to
                </p>
                {PORTAL_LINKS.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-muted"
                  >
                    <Icon size={17} className="text-subtle" aria-hidden />
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto">{body}</main>
      </div>
    </div>
  )
}
