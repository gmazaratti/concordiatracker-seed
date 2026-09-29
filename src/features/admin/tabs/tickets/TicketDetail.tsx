import { Link } from 'react-router-dom'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import type { AdminTicket, TicketPerson, TicketStatus } from '@/lib/tickets'
import { formatDueDateTime } from '@/lib/date'
import { TicketThread } from '@/features/support/TicketThread'
import { StatusSwitch, TicketAvatar } from './ticket-ui'

/**
 * One ticket: the customer card on top with the status beside it, the
 * conversation below. Everything you need to answer without leaving the tab
 * (plan, when they joined, how many times they have written) and one tap to
 * their full record in Users.
 */
export function TicketDetail({
  ticket,
  person,
  onStatus,
  onReplied,
  onBack,
}: {
  ticket: AdminTicket
  person?: TicketPerson
  onStatus: (s: TicketStatus) => void
  onReplied: () => void
  /** Phones show one pane at a time; this returns to the queue. */
  onBack: () => void
}) {
  const name = person?.name ?? ticket.name ?? ticket.email
  const joined = person?.joined_at
    ? new Date(person.joined_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : null
  const facts = [
    person?.handle ? `@${person.handle}` : null,
    ticket.email,
    person?.program ?? null,
    person ? (person.is_pro ? 'Pro' : 'Free') : ticket.source === 'docs' ? 'No account (from the docs)' : null,
    joined ? `joined ${joined}` : null,
    person && person.ticket_count > 1 ? `${person.ticket_count} tickets` : null,
  ].filter((f): f is string => !!f)

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="mb-2 inline-flex items-center gap-1 text-[12px] text-subtle hover:text-fg lg:hidden"
        >
          <ArrowLeft size={13} aria-hidden /> All tickets
        </button>
        <div className="flex flex-wrap items-start gap-3">
          <TicketAvatar ticket={ticket} person={person} className="size-11 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2">
              <span className="truncate text-[15px] font-semibold text-fg">{name}</span>
              {ticket.user_id && (
                <Link
                  to={`?tab=users&user=${ticket.user_id}`}
                  className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-accent hover:underline"
                >
                  Open in Users <ExternalLink size={11} aria-hidden />
                </Link>
              )}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed break-words text-subtle">{facts.join(' · ')}</p>
          </div>
          <StatusSwitch value={ticket.status} onChange={onStatus} />
        </div>
        <div className="mt-3 rounded-lg bg-surface-2/60 px-3 py-2">
          <p className="text-[13.5px] font-medium break-words text-fg">{ticket.subject}</p>
          <p className="mt-0.5 text-[11.5px] text-subtle">
            <span className="tabular-nums">{ticket.case_id}</span> · {ticket.category} · opened{' '}
            {formatDueDateTime(ticket.created_at)}
          </p>
        </div>
      </header>
      <div className="flex min-h-[420px] flex-1 flex-col lg:min-h-0">
        {/* Keyed on the ticket so switching threads remounts rather than
            showing the previous conversation's messages for a beat. */}
        <TicketThread key={ticket.id} ticketId={ticket.id} perspective="staff" onReplied={onReplied} />
      </div>
    </section>
  )
}
