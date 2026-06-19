import { useCallback, useState } from 'react'
import { Globe } from 'lucide-react'
import { adminListBugReports, adminUpdateBugReport, fmtDateTime, useAdminList, type BugReport } from '../admin-data'
import { EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton } from '../admin-ui'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'wont-fix', label: "Won't fix" },
]
const STATUS_TONE: Record<string, string> = {
  open: 'amber',
  'in-progress': 'blue',
  resolved: 'green',
  'wont-fix': 'neutral',
}

export function BugReportsTab() {
  const loader = useCallback(() => adminListBugReports(), [])
  const { items, loading, error, reload } = useAdminList<BugReport>(loader)
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? items : items.filter((b) => b.status === filter)
  const openCount = items.filter((b) => b.status === 'open').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={filter}
          onChange={setFilter}
          options={[{ value: 'all', label: 'All statuses' }, ...STATUSES]}
          ariaLabel="Filter by status"
          size="sm"
          tone="control"
        />
        <RefreshButton onClick={reload} busy={loading} />
      </div>

      <Panel title="Bug reports" sub={loading ? 'Loading…' : `${items.length} total · ${openCount} open`}>
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState>No reports{filter === 'all' ? ' yet' : ` with status “${filter}”`}.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((b) => (
              <BugRow key={b.id} b={b} onChanged={reload} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function BugRow({ b, onChanged }: { b: BugReport; onChanged: () => void }) {
  const [status, setStatus] = useState(b.status)
  const [notes, setNotes] = useState(b.admin_notes ?? '')
  const [isPublic, setIsPublic] = useState(b.public)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const dirty = status !== b.status || notes !== (b.admin_notes ?? '') || isPublic !== b.public

  const save = async () => {
    setBusy(true)
    setErr(null)
    try {
      await adminUpdateBugReport(b.id, status, notes, isPublic)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="px-4 py-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-fg">{b.title}</span>
            <Pill tone={STATUS_TONE[b.status] ?? 'neutral'}>{b.status}</Pill>
          </div>
          {b.description && <p className="mt-0.5 text-[12px] text-muted">{b.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-subtle">
            {b.user_email && <span>{b.user_email}</span>}
            {b.page && <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{b.page}</code>}
            <span>{fmtDateTime(b.created_at)}</span>
          </div>
        </div>
        <Select value={status} onChange={setStatus} options={STATUSES} ariaLabel="Status" size="sm" tone="control" />
      </div>

      <div className="mt-2.5 flex items-end gap-2">
        <div className="flex-1">
          <label className="text-[11px] font-medium text-subtle">Admin notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
            placeholder="Internal notes — root cause, fix, follow-up…"
            className="mt-1 w-full resize-y rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <Button size="sm" disabled={busy || !dirty} onClick={save}>Save</Button>
      </div>

      {/* Curate the public "Recently fixed / Known issues" list on /feedback. */}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          onClick={() => setIsPublic((p) => !p)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium transition-colors duration-150',
            isPublic ? 'border-success/50 bg-success/10 text-success' : 'border-border text-muted hover:bg-surface-2 hover:text-fg',
          )}
        >
          <Globe size={13} aria-hidden />
          {isPublic ? 'Shown in known issues' : 'Show in known issues'}
        </button>
        <span className="text-[11px] text-subtle">
          {isPublic ? `Visible publicly as “${status === 'resolved' ? 'Fixed' : 'Known issue'}”` : 'Off — private to the team'}
        </span>
      </div>
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
    </li>
  )
}
