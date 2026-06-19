import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Bug, Inbox, Link2, Loader2, ShieldAlert, ShieldCheck, Building2, Users } from 'lucide-react'
import { useIsAdmin } from './admin-data'
import { UsersTab } from './tabs/UsersTab'
import { ApplicationsTab } from './tabs/ApplicationsTab'
import { PortalsTab } from './tabs/PortalsTab'
import { VanityTab } from './tabs/VanityTab'
import { BugReportsTab } from './tabs/BugReportsTab'
import { cn } from '@/lib/cn'

const TABS = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'applications', label: 'Applications', icon: Inbox },
  { id: 'portals', label: 'Portals', icon: Building2 },
  { id: 'links', label: 'Links & Vanity', icon: Link2 },
  { id: 'bugs', label: 'Bug reports', icon: Bug },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * Standalone, admin-only console. Defense in depth: the entry point (avatar menu)
 * is hidden for non-admins, this page renders "Not authorized" unless is_admin(),
 * and every underlying RPC is gated on is_admin() at the database — so the data
 * boundary holds even if the UI were bypassed.
 */
export function AdminConsole() {
  const { loading, isAdmin } = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const current = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'users') as TabId
  const select = (id: TabId) => setParams((p) => { p.set('tab', id); return p }, { replace: true })

  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === current)
    let next: number
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    else return
    e.preventDefault()
    select(TABS[next].id)
    refs.current[next]?.focus()
  }

  let body: React.ReactNode
  if (loading) {
    body = (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-6 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  } else if (!isAdmin) {
    body = (
      <div className="mx-auto w-full max-w-md px-5 py-20 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-xl bg-danger/10 text-danger">
          <ShieldAlert size={24} aria-hidden />
        </span>
        <h1 className="mt-4 font-display text-[20px] font-semibold text-fg">Not authorized</h1>
        <p className="mt-1.5 text-[13px] text-subtle">
          The admin console is restricted to the platform administrator.
        </p>
        <Link to="/app" className="mt-4 inline-block text-[13px] font-medium text-accent hover:underline">
          Back to app
        </Link>
      </div>
    )
  } else {
    body = (
      <div className="mx-auto w-full max-w-5xl px-5 py-6">
        <div
          role="tablist"
          aria-label="Admin sections"
          onKeyDown={onKeyDown}
          className="-mx-5 mb-5 flex gap-1 overflow-x-auto border-b border-border px-5"
        >
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
                  'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150',
                  active ? 'border-accent text-fg' : 'border-transparent text-muted hover:text-fg',
                )}
              >
                <Icon size={15} aria-hidden />
                {t.label}
              </button>
            )
          })}
        </div>

        <div role="tabpanel" id={`admin-panel-${current}`} aria-labelledby={`admin-tab-${current}`}>
          {current === 'users' && <UsersTab />}
          {current === 'applications' && <ApplicationsTab />}
          {current === 'portals' && <PortalsTab />}
          {current === 'links' && <VanityTab />}
          {current === 'bugs' && <BugReportsTab />}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-canvas">
      <header className="border-b border-border bg-surface/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <span className="flex items-center gap-2 text-[14px] font-medium text-fg">
            <ShieldCheck size={18} className="text-accent" aria-hidden />
            ConcordiaTracker
            <span className="hidden text-subtle sm:inline">· Admin</span>
          </span>
          <Link
            to="/app"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <ArrowLeft size={14} aria-hidden />
            Back to app
          </Link>
        </div>
      </header>
      {body}
    </div>
  )
}
