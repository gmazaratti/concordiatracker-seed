import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { useModalDismiss } from '@/app/hooks/useModalDismiss'
import { cn } from '@/lib/cn'
import type { AdminUser } from './admin-data'
import { CopyChip, Pill } from './admin-ui'
import {
  userAudit,
  userSummary,
  userVisits,
  type AuditEntry,
  type UserSummary,
  type UserVisit,
} from './user-detail-data'
import { OverviewTab } from './UserOverviewTab'
import { HistoryTab, SubscriptionTab, VisitsTab } from './UserDetailTabs'

type Tab = 'overview' | 'visits' | 'subscription' | 'history'
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'visits', label: 'Visits' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'history', label: 'History' },
]

/**
 * The user inspector — a slide-over, not a dropdown.
 *
 * The old row expanded in place, which meant the list reflowed under your
 * cursor, only one user could be open, and everything worth knowing had to
 * fit in the gap between two rows. This is the main tool for looking at a
 * person, so it gets the whole right-hand side of the screen and the density
 * that allows.
 *
 * PORTALED, because a fixed panel inside a scrolling table inherits the
 * table's stacking and its transforms — the exact trap that rendered the
 * mobile chat as a 44px sliver. It anchors to the viewport or it is not
 * reliable.
 *
 * Loading is per TAB and started on open for the cheap ones, so switching to
 * Visits does not sit on a spinner you could have paid for while reading the
 * Overview. Stripe is NOT prefetched: it is a live call to a third party and
 * most accounts have nothing there.
 */
export function UserDetailPanel({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser
  onClose: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const { ref, onKeyDown } = useModalDismiss<HTMLDivElement>(onClose)

  const [summary, setSummary] = useState<UserSummary | null>(null)
  const [visits, setVisits] = useState<UserVisit[] | null>(null)
  const [audit, setAudit] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState('')

  // A counter, so a refresh after an action re-reads without a setState in an
  // effect body — the react-hooks/set-state-in-effect shape used throughout.
  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => {
    setReloads((n) => n + 1)
    onChanged()
  }, [onChanged])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [s, v, a] = await Promise.all([
          userSummary(user.user_id),
          userVisits(user.user_id),
          userAudit(user.user_id).catch(() => [] as AuditEntry[]),
        ])
        if (!alive) return
        setSummary(s)
        setVisits(v)
        setAudit(a)
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load this user.')
      }
    })()
    return () => {
      alive = false
    }
  }, [user.user_id, reloads])

  const loading = summary === null && visits === null && !error

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" onMouseDown={onClose}>
      <div className="ct-animate-fade absolute inset-0 bg-black/55" aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${user.name || user.email || 'User'} details`}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => e.stopPropagation()}
        className="ct-slide-over relative flex h-full w-full max-w-2xl flex-col border-l border-border bg-canvas shadow-2xl"
      >
        <header className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-display text-[18px] font-semibold text-fg">
                  {user.name || 'Unnamed'}
                </h2>
                {user.plan_status === 'pro' && <Pill tone="green">Pro</Pill>}
                {user.is_internal && <Pill tone="amber">Internal</Pill>}
                {user.comped && <Pill tone="blue">Comped</Pill>}
              </div>
              <p className="mt-0.5 truncate text-[12.5px] text-subtle">{user.email || '—'}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
            >
              <X size={17} aria-hidden />
            </button>
          </div>

          <nav className="-mb-4 mt-3 flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  '-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                  tab === t.id
                    ? 'border-accent text-fg'
                    : 'border-transparent text-muted hover:text-fg',
                )}
              >
                {t.label}
                {t.id === 'history' && audit && audit.length > 0 && (
                  <span className="ml-1.5 text-[11px] text-subtle tabular-nums">{audit.length}</span>
                )}
              </button>
            ))}
          </nav>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <p className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-[12.5px] text-fg">
              {error}
            </p>
          ) : loading ? (
            <p className="flex items-center gap-2 py-10 text-[13px] text-subtle">
              <Loader2 size={15} className="animate-spin" aria-hidden />
              Loading
            </p>
          ) : (
            <>
              {tab === 'overview' && (
                <OverviewTab user={user} summary={summary} audit={audit} onChanged={reload} />
              )}
              {tab === 'visits' && <VisitsTab visits={visits ?? []} summary={summary} />}
              {tab === 'subscription' && <SubscriptionTab user={user} />}
              {tab === 'history' && <HistoryTab entries={audit ?? []} />}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-border px-5 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-subtle">
            User ID <CopyChip value={user.user_id} title="Copy user ID" />
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
