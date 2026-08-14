import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, LifeBuoy, Loader2, Plus } from 'lucide-react'
import { ModalShell } from '@/command/ModalShell'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import { formatDueDateTime } from '@/lib/date'
import {
  CATEGORIES,
  STATUS_META,
  myTickets,
  submitTicket,
  type TicketCategory,
  type TicketStatus,
  type TicketSummary,
} from '@/lib/tickets'
import { TicketThread } from './TicketThread'

type View = { mode: 'list' } | { mode: 'new' } | { mode: 'thread'; ticket: TicketSummary }

/** The student-facing support panel: your conversations, and a form to start a
 * new one. Deliberately a thread list rather than a single contact form — the
 * point is that support is a conversation you can come back to. */
export function SupportModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>({ mode: 'list' })
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null)

  // `refresh` only bumps a counter — the fetch happens in the effect, after an
  // await, so no setState runs synchronously in an effect body.
  const [tick, setTick] = useState(0)
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    let alive = true
    void (async () => {
      const rows = await myTickets().catch(() => [])
      if (alive) setTickets(rows)
    })()
    return () => {
      alive = false
    }
  }, [tick])

  return (
    <ModalShell label="Support" onClose={onClose} widthClass="sm:max-w-lg" scroll={false}>
      <div className="flex h-[min(78vh,620px)] flex-col">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          {view.mode !== 'list' && (
            <button
              type="button"
              onClick={() => setView({ mode: 'list' })}
              aria-label="Back to your tickets"
              className="grid size-7 place-items-center rounded-md text-subtle transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
            >
              <ArrowLeft size={16} aria-hidden />
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate font-display text-[16px] font-semibold text-fg">
            {view.mode === 'thread' ? view.ticket.subject : view.mode === 'new' ? 'New ticket' : 'Support'}
          </h2>
          {view.mode === 'list' && (
            <button
              type="button"
              onClick={() => setView({ mode: 'new' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-[12.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
            >
              <Plus size={14} aria-hidden />
              New
            </button>
          )}
          {view.mode === 'thread' && <StatusBadge status={view.ticket.status} />}
        </header>

        {view.mode === 'list' && (
          <TicketList tickets={tickets} onOpen={(t) => setView({ mode: 'thread', ticket: t })} onNew={() => setView({ mode: 'new' })} />
        )}
        {view.mode === 'new' && (
          <NewTicketForm
            onDone={() => {
              refresh()
              setView({ mode: 'list' })
            }}
          />
        )}
        {view.mode === 'thread' && (
          <TicketThread ticketId={view.ticket.id} perspective="user" onReplied={refresh} />
        )}
      </div>
    </ModalShell>
  )
}

function StatusBadge({ status }: { status: TicketStatus }) {
  const meta = STATUS_META[status]
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1.5 text-[11.5px] font-medium', meta.text)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  )
}

function TicketList({
  tickets,
  onOpen,
  onNew,
}: {
  tickets: TicketSummary[] | null
  onOpen: (t: TicketSummary) => void
  onNew: () => void
}) {
  if (tickets === null) {
    return (
      <div className="grid flex-1 place-items-center">
        <Loader2 className="size-5 animate-spin text-accent" aria-label="Loading" />
      </div>
    )
  }
  if (!tickets.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
          <LifeBuoy size={24} aria-hidden />
        </span>
        <h3 className="font-display text-[17px] font-medium text-fg">No tickets yet</h3>
        <p className="max-w-xs text-[13px] text-muted">
          Something not working, or a question about your account? Open a ticket and we&rsquo;ll
          reply here.
        </p>
        <button
          type="button"
          onClick={onNew}
          className="mt-1 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
        >
          Open a ticket
        </button>
      </div>
    )
  }
  return (
    <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
      {tickets.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onOpen(t)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium text-fg">{t.subject}</span>
                {t.has_unread && (
                  <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="New reply" />
                )}
              </span>
              <span className="mt-0.5 block truncate text-[11.5px] text-subtle">
                {t.case_id} · {formatDueDateTime(t.last_activity_at)}
              </span>
            </span>
            <StatusBadge status={t.status} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function NewTicketForm({ onDone }: { onDone: () => void }) {
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('bug')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const field =
    'w-full rounded-lg border border-border bg-canvas px-3 py-2 text-[13.5px] text-fg placeholder:text-subtle focus:border-accent focus:outline-none'

  async function submit() {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await submitTicket({ subject, message, category })
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create that ticket.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <label className="mb-3 block">
        <span className="mb-1 block text-[12px] font-medium text-muted">What is this about?</span>
        <Select
          ariaLabel="Ticket category"
          value={category}
          onChange={(v) => setCategory(v as TicketCategory)}
          options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-[12px] font-medium text-muted">Subject</span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="A one-line summary"
          maxLength={200}
          className={field}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[12px] font-medium text-muted">What happened?</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={7}
          placeholder="What you were doing, what you expected, and what happened instead."
          className={cn(field, 'resize-y')}
        />
      </label>

      {error && <p className="mt-2 text-[12px] font-medium text-danger">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={busy || subject.trim().length < 3 || message.trim().length < 10}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-medium text-accent-contrast transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Loader2 size={15} className="animate-spin" aria-hidden />}
        Send ticket
      </button>
      <p className="mt-2 text-center text-[11.5px] text-subtle">
        We reply in this panel, and you can follow up here any time.
      </p>
    </div>
  )
}
