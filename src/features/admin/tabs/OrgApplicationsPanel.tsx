import { useCallback, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import {
  adminListOrgApplications,
  adminSetOrgStatus,
  useAdminList,
  type OrgApplication,
} from '../admin-data'
import { EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton } from '../admin-ui'

/**
 * Applications to be listed — the queue you decide from.
 *
 * WHY IT IS ITS OWN PANEL. The Organizations list shows every org, mostly
 * seeded ones, with a name and a handle. Approving is a judgement call about
 * whether a club is real, and a row reading "Robotics Club, @robotics" gives
 * nobody anything to judge. This shows the six answers, the person's name and
 * role, their email, and whatever link they offered as proof — and only for
 * rows that are actually waiting on a decision.
 */
export function OrgApplicationsPanel() {
  const loader = useCallback(() => adminListOrgApplications(), [])
  const apps = useAdminList<OrgApplication>(loader)
  const [busy, setBusy] = useState('')

  const decide = async (id: string, status: 'approved' | 'banned') => {
    setBusy(id)
    try {
      await adminSetOrgStatus(id, status)
      apps.reload()
    } finally {
      setBusy('')
    }
  }

  const pending = apps.items.filter((a) => a.status === 'pending')

  return (
    <Panel
      title="Applications"
      sub={
        apps.loading
          ? 'Loading…'
          : pending.length > 0
            ? `${pending.length} waiting on you`
            : 'Nothing waiting'
      }
      action={<RefreshButton onClick={apps.reload} busy={apps.loading} />}
    >
      {apps.loading ? (
        <Loading />
      ) : apps.error ? (
        <ErrorState message={apps.error} />
      ) : apps.items.length === 0 ? (
        <EmptyState>No applications yet.</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {apps.items.map((a) => (
            <Row key={a.id} app={a} busy={busy === a.id} onDecide={decide} />
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Row({
  app: a,
  busy,
  onDecide,
}: {
  app: OrgApplication
  busy: boolean
  onDecide: (id: string, status: 'approved' | 'banned') => void
}) {
  const q = a.application ?? {}
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[13.5px] font-medium text-fg">{a.name}</span>
        <span className="text-[12px] text-subtle">{a.handle}</span>
        <Pill tone={a.status === 'approved' ? 'green' : a.status === 'pending' ? 'amber' : 'red'}>
          {a.status}
        </Pill>
        {a.applied_at && (
          <span className="ml-auto text-[11.5px] text-subtle">
            {new Date(a.applied_at).toLocaleDateString()}
          </span>
        )}
      </div>

      {q.what && <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{q.what}</p>}

      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-subtle">
        {q.role && (
          <Fact label="From">
            {a.owner_name ? `${a.owner_name}, ${q.role}` : q.role}
          </Fact>
        )}
        {q.size && <Fact label="Size">{q.size}</Fact>}
        {q.category && <Fact label="Posts">{q.category}</Fact>}
        {(q.contact || a.owner_email) && <Fact label="Email">{q.contact || a.owner_email}</Fact>}
      </dl>

      {q.proof && (
        // The one field worth clicking, so it is a link. rel=noreferrer
        // because it is a URL a stranger supplied.
        <a
          href={q.proof.startsWith('http') ? q.proof : `https://${q.proof}`}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-accent hover:underline"
        >
          {q.proof}
          <ExternalLink size={11} aria-hidden />
        </a>
      )}

      {a.status === 'pending' && (
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(a.id, 'approved')}
            className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(a.id, 'banned')}
            className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] text-muted transition-colors duration-150 hover:text-danger disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      )}
    </li>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span>
      <dt className="inline text-subtle">{label}: </dt>
      <dd className="inline text-muted">{children}</dd>
    </span>
  )
}
