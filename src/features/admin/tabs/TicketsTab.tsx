import { useCallback, useEffect, useState } from 'react'
import { Mail, MonitorSmartphone } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatDueDateTime } from '@/lib/date'
import {
  STATUS_META,
  adminTickets,
  setTicketStatus,
  type AdminTicket,
  type TicketStatus,
} from '@/lib/tickets'
import { TicketThread } from '@/features/support/TicketThread'
import { EmptyState, Loading, Panel, SearchBar } from '../admin-ui'

const FILTERS: { id: TicketStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'answered', label: 'Answered' },
  { id: 'solved', label: 'Solved' },
  { id: 'all', label: 'All' },
]

/** The support inbox — a queue on the left, the conversation on the right.
 * Open tickets sort first (the RPC does it), so the list reads as work to do
 * rather than a reverse-chronological log. */
export function TicketsTab() {
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AdminTicket[] | null>(null)
  const [selected, setSelected] = useState<AdminTicket | null>(null)

  // `load` only bumps a counter; the fetch runs in the effect after an await,
  // so nothing setStates synchronously in an effect body.
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const list = await adminTickets(filter === 'all' ? null : filter, q).catch(() => [])
      if (!alive) return
      setRows(list)
      // Keep the open conversation in sync with the refreshed row, and drop the
      // selection if the filter no longer includes it.
      setSelected((cur) => (cur ? (list.find((t) => t.id === cur.id) ?? null) : null))
    })()
    return () => {
      alive = false
    }
  }, [filter, q, tick])

  async function changeStatus(id: string, status: TicketStatus) {
    await setTicketStatus(id, status)
    load()
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 lg:max-w-md">
        <Panel title="Support tickets">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                  filter === f.id
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="border-b border-border px-3 py-2.5">
            <SearchBar value={q} onChange={setQ} placeholder="Case number, subject, or email…" />
          </div>

          {rows === null ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState>No tickets match.</EmptyState>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
              {rows.map((t) => {
                const meta = STATUS_META[t.status]
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(t)}
                      className={cn(
                        'w-full px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-2',
                        selected?.id === t.id && 'bg-surface-2',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn('size-1.5 shrink-0 rounded-full', meta.dot)} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">
                          {t.subject}
                        </span>
                        <span className="shrink-0 text-[11px] text-subtle tabular-nums">
                          {t.case_id}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-[11.5px] text-subtle">
                        <span className="inline-flex items-center gap-1">
                          {t.source === 'docs' ? (
                            <MonitorSmartphone size={11} aria-label="From the docs" />
                          ) : (
                            <Mail size={11} aria-label="From the app" />
                          )}
                          {t.name || t.email}
                        </span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{formatDueDateTime(t.last_activity_at)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <div className="min-w-0 flex-1">
        {selected ? (
          <Panel title={`${selected.case_id} · ${selected.subject}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 text-[12px] text-subtle">
              <span>{selected.email}</span>
              <span aria-hidden>·</span>
              <span>{selected.category}</span>
              <span aria-hidden>·</span>
              <span>opened {formatDueDateTime(selected.created_at)}</span>
              <span className="ml-auto flex items-center gap-1.5">
                {(['open', 'answered', 'solved'] as TicketStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void changeStatus(selected.id, s)}
                    className={cn(
                      'rounded-md px-2 py-0.5 text-[11.5px] font-medium transition-colors duration-150',
                      selected.status === s
                        ? cn('bg-surface-2', STATUS_META[s].text)
                        : 'text-subtle hover:bg-surface-2 hover:text-fg',
                    )}
                  >
                    {STATUS_META[s].label}
                  </button>
                ))}
              </span>
            </div>
            <div className="flex h-[min(60vh,560px)] flex-col">
              {/* Keyed on the ticket so switching threads remounts rather than
                  showing the previous conversation's messages for a beat. */}
              <TicketThread
                key={selected.id}
                ticketId={selected.id}
                perspective="staff"
                onReplied={load}
              />
            </div>
          </Panel>
        ) : (
          <Panel title="Conversation">
            <EmptyState>Pick a ticket to read and reply.</EmptyState>
          </Panel>
        )}
      </div>
    </div>
  )
}
