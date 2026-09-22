import { LifeBuoy, Loader2 } from 'lucide-react'
import { Mascot } from '@/components/Mascot'
import { useSupport } from '@/app/providers/support'
import { STATUS_META, type TicketSummary } from '@/lib/tickets'
import { shortAgo } from '@/lib/social'
import { TicketThread } from '@/features/support/TicketThread'
import { cn } from '@/lib/cn'

/** Module level so reading the clock is allowed — `react-hooks/purity`
 *  bars it in a component body. Same shape as PeoplePanel's own `ago`. */
const age = (iso: string) => shortAgo(iso, Date.now())

/**
 * Support, in the inbox.
 *
 * WHY IT BELONGS HERE. Writing to support is a conversation — you say
 * something, a person answers, you answer back — and it was the only
 * conversation in the product that lived somewhere else: a modal behind the
 * avatar menu, which is a place you go when you already know it exists. So a
 * reply sat unread in a screen nobody had a reason to open, while the one
 * screen called Messages said you had none.
 *
 * IT IS NOT A FAKE PERSON. There is no avatar pretending to be a human and no
 * handle: the row carries a lifebuoy, the case number and the status, because
 * "Answered" and "Solved" are facts a DM does not have and are exactly what
 * you want to know before opening it. The thread itself is the same
 * `TicketThread` the admin console reads, so neither side can render a
 * message the other cannot.
 */

/** The rows, rendered into the conversation list's own `<ul>`. */
export function SupportThreads({
  tickets,
  activeId,
  onOpen,
}: {
  tickets: TicketSummary[]
  activeId: string | null
  onOpen: (id: string) => void
}) {
  return (
    <>
      {tickets.map((t) => (
        <li
          key={t.id}
          className={cn(
            'flex items-center pr-1 transition-colors duration-150',
            activeId === t.id ? 'lg:bg-accent-soft' : 'hover:bg-surface-2/60',
          )}
        >
          <button
            type="button"
            onClick={() => onOpen(t.id)}
            className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-1 pl-0.5 text-left lg:px-3"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
              <LifeBuoy size={20} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[13.5px] text-fg',
                    t.has_unread ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {t.subject}
                </span>
                <span className="shrink-0 text-[11px] text-subtle">
                  {age(t.last_activity_at)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[12.5px]',
                    t.has_unread ? 'font-medium text-fg' : 'text-subtle',
                  )}
                >
                  <span className={cn('mr-1.5 inline-block size-1.5 rounded-full align-middle', STATUS_META[t.status].dot)} />
                  {STATUS_META[t.status].label} · {t.case_id}
                </span>
                {t.has_unread && (
                  <span className="size-2 shrink-0 rounded-full bg-accent" aria-hidden />
                )}
              </span>
            </span>
          </button>
        </li>
      ))}
    </>
  )
}

/** The conversation, in the pane a DM would occupy. */
export function SupportConversation({
  ticket,
  onBack,
  onReplied,
}: {
  ticket: TicketSummary | undefined
  onBack: () => void
  onReplied: () => void
}) {
  if (!ticket) return null
  const meta = STATUS_META[ticket.status]
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border/70 px-3 py-2.5">
        <button
          type="button"
          onClick={onBack}
          className="rounded px-1 text-[13px] text-muted transition-colors hover:text-fg lg:hidden"
          aria-label="Back to conversations"
        >
          ←
        </button>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
          <LifeBuoy size={17} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-fg">{ticket.subject}</p>
          <p className="flex items-center gap-1.5 truncate text-[11.5px] text-subtle">
            <span className={cn('inline-block size-1.5 rounded-full', meta.dot)} aria-hidden />
            {meta.label} · {ticket.case_id}
          </p>
        </div>
      </div>
      <TicketThread ticketId={ticket.id} perspective="user" onReplied={onReplied} />
    </div>
  )
}

/**
 * The Support pill's own list.
 *
 * It exists because the user asked for one, and because a person who came
 * here for a ticket should not have to pick it out of their classmates. The
 * rows are the same component, so what the pill shows and what the inbox
 * shows cannot drift.
 */
export function SupportPane({
  tickets,
  loading,
  activeId,
  onOpen,
}: {
  tickets: TicketSummary[]
  loading: boolean
  activeId: string | null
  onOpen: (id: string) => void
}) {
  const { openSupport } = useSupport()

  if (loading) {
    return (
      <p className="flex items-center gap-2 py-10 text-[13px] text-subtle">
        <Loader2 size={15} className="animate-spin" aria-hidden />
        Loading
      </p>
    )
  }

  return (
    <div>
      {tickets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-12 text-center">
          <Mascot mood="resting" size="sm" soft className="text-accent" />
          <p className="text-[13.5px] font-medium text-fg">No support conversations</p>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-subtle">
            Something broken, a billing question, or a class the app has wrong — start one and the
            reply lands here, in your messages.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border lg:divide-y-0">
          <SupportThreads tickets={tickets} activeId={activeId} onOpen={onOpen} />
        </ul>
      )}

      <button
        type="button"
        onClick={() => openSupport()}
        className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-accent-contrast transition-colors duration-150 hover:bg-accent-hover"
      >
        Contact support
      </button>
    </div>
  )
}
