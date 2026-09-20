import { useCallback, useState } from 'react'
import { BookOpen, ChevronRight, FileCheck2, Users2 } from 'lucide-react'
import { adminListUsers, fmtDate, useAdminList, type AdminUser } from '../admin-data'
import { EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton, SearchBar } from '../admin-ui'
import { UserDetailPanel } from '../UserDetailPanel'
import { cn } from '@/lib/cn'

type Filter = 'all' | 'paying' | 'pro' | 'internal'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'paying', label: 'Paying' },
  { id: 'pro', label: 'Pro' },
  { id: 'internal', label: 'Internal' },
]

/**
 * The user list, and a slide-over for one person.
 *
 * The row used to expand in place: the list reflowed under the cursor, one
 * user at a time, and everything worth knowing had to fit in the gap between
 * two rows. Inspecting a person is the main job of this screen, so it gets
 * the panel and the density that allows.
 *
 * Filters carry counts, for the same reason the ticket queue does — a list
 * that silently hides two of four rows reads as rows going missing.
 */
export function UsersTab() {
  const loader = useCallback(() => adminListUsers(), [])
  const { items, loading, error, reload } = useAdminList<AdminUser>(loader)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  // Opened from elsewhere — Traffic's "online now" list links here rather
  // than rebuilding a user panel of its own, so the message box, the plan
  // controls and the audit trail are all the ones that already exist.
  const [openId, setOpenId] = useState<string | null>(() => {
    try {
      return new URLSearchParams(window.location.search).get('user')
    } catch {
      return null
    }
  })

  const needle = q.trim().toLowerCase()
  const matches = (u: AdminUser) =>
    !needle ||
    (u.name ?? '').toLowerCase().includes(needle) ||
    (u.email ?? '').toLowerCase().includes(needle) ||
    (u.vanity_code ?? '').toLowerCase().includes(needle)

  // "Paying" means Stripe has a subscription on them and we have not comped
  // them. Deliberately not "plan_status = pro", which counts the gifts.
  const isPaying = (u: AdminUser) =>
    !!u.stripe_customer_id && !u.comped && !u.is_internal && u.plan_status === 'pro'

  const inFilter = (u: AdminUser) =>
    filter === 'all'
      ? true
      : filter === 'paying'
        ? isPaying(u)
        : filter === 'pro'
          ? u.plan_status === 'pro'
          : !!u.is_internal

  const searched = items.filter(matches)
  const shown = searched.filter(inFilter)
  const counts: Record<Filter, number> = {
    all: searched.length,
    paying: searched.filter(isPaying).length,
    pro: searched.filter((u) => u.plan_status === 'pro').length,
    internal: searched.filter((u) => u.is_internal).length,
  }
  const open = openId ? (items.find((u) => u.user_id === openId) ?? null) : null

  return (
    <div className="space-y-4">
      <SearchBar value={q} onChange={setQ} placeholder="Search by name, email, or code…">
        <RefreshButton onClick={reload} busy={loading} />
      </SearchBar>

      <Panel
        title="Platform users"
        sub={loading ? 'Loading…' : `${shown.length} of ${items.length}`}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                filter === f.id
                  ? 'bg-accent-soft text-accent'
                  : 'text-muted hover:bg-surface-2 hover:text-fg',
              )}
            >
              {f.label}
              <span className="text-[11px] tabular-nums opacity-70">{counts[f.id]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : shown.length === 0 ? (
          <EmptyState>No users match.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((u) => (
              <li key={u.user_id}>
                <button
                  type="button"
                  onClick={() => setOpenId(u.user_id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-fg">
                        {u.name || 'Unnamed'}
                      </span>
                      {isPaying(u) && <Pill tone="green">Paying</Pill>}
                      {u.comped && <Pill tone="blue">Comped</Pill>}
                      {u.is_internal && <Pill tone="amber">Internal</Pill>}
                      {u.subscription_status === 'trialing' && <Pill tone="neutral">Trial</Pill>}
                    </div>
                    <span className="truncate text-[12px] text-subtle">{u.email || '—'}</span>
                  </div>
                  <div className="hidden items-center gap-4 text-[12px] text-subtle sm:flex">
                    <span title="Courses" className="inline-flex items-center gap-1">
                      <BookOpen size={13} aria-hidden />
                      {u.course_count}
                    </span>
                    <span title="Assignments" className="inline-flex items-center gap-1">
                      <FileCheck2 size={13} aria-hidden />
                      {u.assignment_count}
                    </span>
                    <span title="Following" className="inline-flex items-center gap-1">
                      <Users2 size={13} aria-hidden />
                      {u.following_count}
                    </span>
                  </div>
                  <span className="hidden text-[11px] text-subtle md:inline">
                    {u.last_seen_at ? fmtDate(u.last_seen_at) : 'never seen'}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-subtle" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {open && (
        <UserDetailPanel user={open} onClose={() => setOpenId(null)} onChanged={reload} />
      )}
    </div>
  )
}
