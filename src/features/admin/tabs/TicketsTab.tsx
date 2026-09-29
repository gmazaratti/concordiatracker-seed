import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import {
  adminTicketPeople,
  adminTickets,
  setTicketStatus,
  type AdminTicket,
  type TicketPerson,
  type TicketStatus,
} from '@/lib/tickets'
import { EmptyState, Loading, SearchBar } from '../admin-ui'
import { TicketQueue } from './tickets/TicketQueue'
import { TicketDetail } from './tickets/TicketDetail'
import { MessagesSquare } from 'lucide-react'

const FILTERS: { id: TicketStatus | 'all'; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'answered', label: 'Answered' },
  { id: 'solved', label: 'Solved' },
  { id: 'all', label: 'All' },
]

/**
 * The support inbox: a queue on the left, the customer and the conversation
 * on the right. On a phone they are one screen at a time.
 *
 * EVERY status is fetched and the filter narrows in the client, so each chip
 * carries its count and a hidden ticket is always visible AS a number (the
 * server-side filter once made two of four tickets silently vanish).
 *
 * Status changes are OPTIMISTIC: the switch moves on the tap and the row
 * follows, and a refusal puts it back. Waiting on a round trip to see your own
 * click land is what made changing statuses feel slow.
 */
export function TicketsTab() {
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<AdminTicket[] | null>(null)
  const [people, setPeople] = useState<Map<string, TicketPerson>>(new Map())
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // `load` only bumps a counter; the fetch runs in the effect after an await,
  // so nothing setStates synchronously in an effect body.
  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const list = await adminTickets(null, q).catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load tickets.')
        return null
      })
      if (!alive) return
      if (list) setError('')
      setRows(list ?? [])
      const ids = (list ?? []).map((t) => t.user_id).filter((id): id is string => !!id)
      const faces = await adminTicketPeople(ids)
      if (alive) setPeople(faces)
    })()
    return () => {
      alive = false
    }
  }, [q, tick])

  const all = rows ?? []
  const counts = {
    all: all.length,
    open: all.filter((t) => t.status === 'open').length,
    answered: all.filter((t) => t.status === 'answered').length,
    solved: all.filter((t) => t.status === 'solved').length,
  }
  const shown = all.filter((t) => filter === 'all' || t.status === filter)
  const selected = all.find((t) => t.id === selectedId) ?? null

  async function changeStatus(id: string, status: TicketStatus) {
    const before = rows
    setRows((cur) => (cur ?? []).map((t) => (t.id === id ? { ...t, status } : t)))
    try {
      await setTicketStatus(id, status)
    } catch (e) {
      setRows(before)
      setError(e instanceof Error ? e.message : 'That status did not save.')
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-11rem)] lg:min-h-[560px] lg:flex-row">
      {/* Queue. Hidden on a phone while a ticket is open. */}
      <section
        className={cn(
          'flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:w-[380px] lg:shrink-0',
          selected && 'hidden lg:flex',
        )}
      >
        <div className="border-b border-border px-3.5 pt-3 pb-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-[16px] font-bold text-fg">Support</h2>
            {counts.open > 0 && (
              <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11.5px] font-semibold text-warning">
                {counts.open} open
              </span>
            )}
          </div>
          <div className="mt-2.5">
            <SearchBar value={q} onChange={setQ} placeholder="Case, subject, name or email" />
          </div>
          <div className="mt-2 flex gap-1 overflow-x-auto">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors duration-150',
                  filter === f.id ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {f.label}
                {rows !== null && <span className="text-[11px] tabular-nums opacity-70">{counts[f.id]}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {rows === null ? (
            <Loading />
          ) : error && all.length === 0 ? (
            <div className="px-4 py-6 text-[13px] leading-relaxed text-danger">
              {error}
              <span className="mt-1.5 block text-[12px] text-subtle">
                If this mentions a missing function, run <code>db/tickets.sql</code>.
              </span>
            </div>
          ) : shown.length === 0 ? (
            <EmptyState>
              {counts.all > 0 && filter !== 'all'
                ? `No ${filter} tickets. ${counts.all} in total, try All.`
                : 'No tickets match.'}
            </EmptyState>
          ) : (
            <TicketQueue rows={shown} people={people} selectedId={selectedId} onSelect={(t) => setSelectedId(t.id)} />
          )}
        </div>
      </section>

      {/* Conversation. */}
      <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !selected && 'hidden lg:flex')}>
        {error && all.length > 0 && <p className="mb-2 text-[12px] text-danger">{error}</p>}
        {selected ? (
          <TicketDetail
            ticket={selected}
            person={selected.user_id ? people.get(selected.user_id) : undefined}
            onStatus={(s) => void changeStatus(selected.id, s)}
            onReplied={load}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border-strong p-10 text-center">
            <div>
              <MessagesSquare size={22} className="mx-auto text-subtle" aria-hidden />
              <p className="mt-2 text-[13px] text-subtle">Pick a ticket to read and reply.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
