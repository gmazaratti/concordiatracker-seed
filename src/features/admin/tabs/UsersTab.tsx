import { useCallback, useState } from 'react'
import { BookOpen, ChevronDown, FileCheck2, Users2 } from 'lucide-react'
import {
  adminListUsers,
  adminSetBlueprintPermission,
  adminSetPlan,
  adminSetUserNotes,
  fmtDate,
  useAdminList,
  type AdminUser,
} from '../admin-data'
import { CopyChip, EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton, SearchBar } from '../admin-ui'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const DURATIONS = [
  { value: '1', label: '1 month' },
  { value: '3', label: '3 months' },
  { value: '6', label: '6 months' },
  { value: '12', label: '1 year' },
  { value: '0', label: 'Forever' },
]

function monthsFromNow(m: number): string | null {
  if (m === 0) return null
  const d = new Date()
  d.setMonth(d.getMonth() + m)
  return d.toISOString()
}

export function UsersTab() {
  const loader = useCallback(() => adminListUsers(), [])
  const { items, loading, error, reload } = useAdminList<AdminUser>(loader)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const needle = q.trim().toLowerCase()
  const filtered = items.filter(
    (u) =>
      !needle ||
      (u.name ?? '').toLowerCase().includes(needle) ||
      (u.email ?? '').toLowerCase().includes(needle) ||
      (u.vanity_code ?? '').toLowerCase().includes(needle),
  )

  return (
    <div className="space-y-4">
      <SearchBar value={q} onChange={setQ} placeholder="Search by name, email, or code…">
        <RefreshButton onClick={reload} busy={loading} />
      </SearchBar>

      <Panel title="Platform users" sub={loading ? 'Loading…' : `${filtered.length} of ${items.length}`}>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState>No users match.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((u) => (
              <UserRow key={u.user_id} u={u} open={open === u.user_id} onToggle={() => setOpen(open === u.user_id ? null : u.user_id)} onChanged={reload} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function UserRow({ u, open, onToggle, onChanged }: { u: AdminUser; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const [notes, setNotes] = useState(u.admin_notes ?? '')
  const [busy, setBusy] = useState(false)
  const [duration, setDuration] = useState('3')
  const [err, setErr] = useState<string | null>(null)

  const isPro = u.plan_status === 'pro'

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr(null)
    try {
      await fn()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2/50"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-fg">{u.name || 'Unnamed'}</span>
            {isPro && <Pill tone="green">Pro</Pill>}
            {!u.can_upload_blueprints && <Pill tone="amber">No uploads</Pill>}
          </div>
          <span className="truncate text-[12px] text-subtle">{u.email || '—'}</span>
        </div>
        <div className="hidden items-center gap-4 text-[12px] text-subtle sm:flex">
          <span title="Courses" className="inline-flex items-center gap-1"><BookOpen size={13} aria-hidden />{u.course_count}</span>
          <span title="Assignments" className="inline-flex items-center gap-1"><FileCheck2 size={13} aria-hidden />{u.assignment_count}</span>
          <span title="Following" className="inline-flex items-center gap-1"><Users2 size={13} aria-hidden />{u.following_count}</span>
        </div>
        <span className="font-mono text-[11px] text-subtle">{u.vanity_code ?? '—'}</span>
        <ChevronDown size={16} className={cn('shrink-0 text-subtle transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border bg-surface-2/30 px-4 py-4">
          <div className="flex flex-wrap items-center gap-4 text-[12px] text-subtle">
            <span>Joined {fmtDate(u.created_at)}</span>
            <span className="inline-flex items-center gap-1.5">ID <CopyChip value={u.user_id} title="Copy user ID" /></span>
            <span className="sm:hidden">{u.course_count} courses · {u.assignment_count} assignments · {u.following_count} following</span>
          </div>

          {/* Plan */}
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12px] text-muted">
                Plan: <span className="font-medium text-fg">{isPro ? 'Pro' : 'Free'}</span>
                {isPro && u.plan_expires_at && <span className="text-subtle"> · expires {fmtDate(u.plan_expires_at)}</span>}
                {isPro && !u.plan_expires_at && <span className="text-subtle"> · no expiry</span>}
              </div>
              <div className="flex items-center gap-2">
                <Select value={duration} onChange={setDuration} options={DURATIONS} ariaLabel="Pro duration" size="sm" tone="control" />
                <Button size="sm" disabled={busy} onClick={() => run(() => adminSetPlan(u.user_id, 'pro', monthsFromNow(Number(duration))))}>
                  Grant Pro
                </Button>
                {isPro && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => adminSetPlan(u.user_id, 'free', null))}>
                    Revoke
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Blueprint upload permission */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3">
            <div className="text-[12px] text-muted">
              Blueprint uploads:{' '}
              <span className={cn('font-medium', u.can_upload_blueprints ? 'text-fg' : 'text-warning')}>
                {u.can_upload_blueprints ? 'Allowed' : 'Revoked'}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run(() => adminSetBlueprintPermission(u.user_id, !u.can_upload_blueprints))}
            >
              {u.can_upload_blueprints ? 'Revoke uploads' : 'Allow uploads'}
            </Button>
          </div>

          {/* Notes / tags */}
          <div className="rounded-lg border border-border bg-surface p-3">
            <label className="text-[12px] font-medium text-muted">Notes &amp; tags</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Private admin notes — e.g. VIP, refunded, flagged…"
              className="mt-1.5 w-full resize-y rounded-md border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" disabled={busy || notes === (u.admin_notes ?? '')} onClick={() => run(() => adminSetUserNotes(u.user_id, notes))}>
                Save notes
              </Button>
            </div>
          </div>

          {err && <p className="text-[12px] text-danger">{err}</p>}
        </div>
      )}
    </li>
  )
}
