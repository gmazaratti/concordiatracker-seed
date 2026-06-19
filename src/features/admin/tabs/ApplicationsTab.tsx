import { useCallback, useState } from 'react'
import {
  adminListApplications,
  adminResolveApplication,
  fmtDate,
  useAdminList,
  type Application,
} from '../admin-data'
import { EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton } from '../admin-ui'
import { Button } from '@/components/ui/Button'

const KIND_LABEL: Record<Application['kind'], string> = {
  request: 'Request form',
  organization: 'Pending org',
  teacher: 'Pending account',
}
const STATUS_TONE: Record<string, string> = {
  pending: 'amber',
  accepted: 'green',
  approved: 'green',
  denied: 'red',
}

export function ApplicationsTab() {
  const loader = useCallback(() => adminListApplications(), [])
  const { items, loading, error, reload } = useAdminList<Application>(loader)

  const teacher = items.filter((a) => a.role === 'teacher')
  const organizer = items.filter((a) => a.role === 'organizer')

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <RefreshButton onClick={reload} busy={loading} />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <Panel title="Applications"><ErrorState message={error} /></Panel>
      ) : (
        <>
          <Section title="Teacher applications" items={teacher} onChanged={reload} />
          <Section title="Organizer applications" items={organizer} onChanged={reload} />
        </>
      )}
    </div>
  )
}

function Section({ title, items, onChanged }: { title: string; items: Application[]; onChanged: () => void }) {
  const pending = items.filter((a) => a.status === 'pending').length
  return (
    <Panel title={title} sub={`${items.length} total · ${pending} pending`}>
      {items.length === 0 ? (
        <EmptyState>No applications.</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((a) => (
            <Row key={`${a.kind}-${a.ref_id}`} a={a} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Row({ a, onChanged }: { a: Application; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const resolve = async (accept: boolean) => {
    setBusy(true)
    setErr(null)
    try {
      await adminResolveApplication(a.kind, a.ref_id, accept)
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Action failed')
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[13px] font-medium text-fg">{a.name}</span>
          <Pill tone={STATUS_TONE[a.status] ?? 'neutral'}>{a.status}</Pill>
          <span className="text-[11px] text-subtle">{KIND_LABEL[a.kind]}</span>
        </div>
        <div className="truncate text-[12px] text-subtle">{a.email}</div>
        {a.detail && <div className="mt-0.5 truncate text-[12px] text-muted">{a.detail}</div>}
        {err && <div className="mt-1 text-[12px] text-danger">{err}</div>}
      </div>
      <span className="text-[11px] text-subtle">{fmtDate(a.created_at)}</span>
      {a.status === 'pending' && (
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={busy} onClick={() => resolve(true)}>Accept</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve(false)}>Deny</Button>
        </div>
      )}
    </li>
  )
}
