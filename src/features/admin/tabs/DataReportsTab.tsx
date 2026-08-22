import { useCallback, useState } from 'react'
import { BookX, Flag } from 'lucide-react'
import {
  adminListDataReports,
  adminUpdateDataReport,
  fmtDateTime,
  useAdminList,
  type DataReport,
} from '../admin-data'
import { EmptyState, ErrorState, Loading, Panel, Pill, RefreshButton } from '../admin-ui'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

/**
 * What students say we have wrong.
 *
 * The course catalogue, the meeting patterns and the credit values are a mirror
 * of Concordia's own calendar, and a mirror is only as good as its last sync.
 * This queue is how the gap gets noticed: each row is one claim, with the value
 * we show beside the value the student says it should be, so it can be checked
 * against the source rather than believed or waved away.
 *
 * Nothing here touches the student's own copy — they already edited that, and
 * were never blocked on us. What is at stake is the copy everyone else gets.
 */
const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'applied', label: 'Fixed at source' },
  { value: 'dismissed', label: 'Not a problem' },
]
const STATUS_TONE: Record<string, string> = {
  open: 'amber',
  reviewed: 'blue',
  applied: 'green',
  dismissed: 'neutral',
}
const KIND_LABEL: Record<string, string> = {
  course_info: 'Wrong field',
  missing_course: 'Missing course',
  section: 'Section',
}

export function DataReportsTab() {
  const loader = useCallback(() => adminListDataReports(), [])
  const { items, loading, error, reload } = useAdminList<DataReport>(loader)
  const [filter, setFilter] = useState('all')
  const [kind, setKind] = useState('all')

  const filtered = items.filter(
    (r) => (filter === 'all' || r.status === filter) && (kind === 'all' || r.kind === kind),
  )
  const openCount = items.filter((r) => r.status === 'open').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Select
            value={kind}
            onChange={setKind}
            options={[
              { value: 'all', label: 'All kinds' },
              { value: 'course_info', label: 'Wrong field' },
              { value: 'missing_course', label: 'Missing course' },
            ]}
            ariaLabel="Filter by kind"
            size="sm"
            tone="control"
          />
          <Select
            value={filter}
            onChange={setFilter}
            options={[{ value: 'all', label: 'All statuses' }, ...STATUSES]}
            ariaLabel="Filter by status"
            size="sm"
            tone="control"
          />
        </div>
        <RefreshButton onClick={reload} busy={loading} />
      </div>

      <Panel
        title="Data reports"
        sub={loading ? 'Loading...' : `${items.length} total \u00b7 ${openCount} open`}
      >
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState>
            Nothing reported. Either the mirror is accurate or nobody has said otherwise.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((r) => (
              <ReportRow key={r.id} report={r} onSaved={reload} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function ReportRow({ report: r, onSaved }: { report: DataReport; onSaved: () => void }) {
  const [status, setStatus] = useState(r.status)
  const [notes, setNotes] = useState(r.admin_notes ?? '')
  const [busy, setBusy] = useState(false)
  const dirty = status !== r.status || notes !== (r.admin_notes ?? '')
  const Icon = r.kind === 'missing_course' ? BookX : Flag

  async function save() {
    setBusy(true)
    try {
      await adminUpdateDataReport(r.id, status, notes)
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Icon size={14} className="shrink-0 text-subtle" aria-hidden />
        <span className="text-[13px] font-semibold text-fg">{r.course_code || '\u2014'}</span>
        <Pill tone="neutral">{KIND_LABEL[r.kind] ?? r.kind}</Pill>
        {r.field && <Pill tone="neutral">{r.field}</Pill>}
        <Pill tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Pill>
        <span className="ml-auto text-[11.5px] text-subtle">{fmtDateTime(r.created_at)}</span>
      </div>

      {/* Both sides, side by side. Which one is right is a question for the
          calendar, and the value of the queue is making that comparison take
          one glance instead of three tabs. */}
      {(r.current_value || r.suggested_value) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
            <p className="text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
              We show
            </p>
            <p className="mt-0.5 text-[12.5px] break-words text-muted">
              {r.current_value || '\u2014'}
            </p>
          </div>
          <div className="rounded-lg border border-accent/40 bg-accent-soft/30 px-3 py-2">
            <p className="text-[10.5px] font-semibold tracking-wide text-subtle uppercase">
              They say
            </p>
            <p className="mt-0.5 text-[12.5px] break-words text-fg">
              {r.suggested_value || '\u2014'}
            </p>
          </div>
        </div>
      )}

      {r.note && <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{r.note}</p>}
      {r.payload && Object.keys(r.payload).length > 0 && (
        <p className="mt-1 text-[11.5px] text-subtle">
          {Object.entries(r.payload)
            .filter(([, v]) => v !== null && v !== '')
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(' \u00b7 ')}
        </p>
      )}
      <p className="mt-1 text-[11.5px] text-subtle">{r.user_email ?? 'Unknown reporter'}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Select
          value={status}
          onChange={setStatus}
          options={STATUSES}
          ariaLabel="Status"
          size="sm"
          tone="control"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes - what did the calendar actually say?"
          className="min-w-0 flex-1 rounded-lg border border-border bg-canvas px-3 py-1.5 text-[12.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none"
        />
        <Button size="sm" onClick={() => void save()} disabled={!dirty || busy}>
          Save
        </Button>
      </div>
    </li>
  )
}
