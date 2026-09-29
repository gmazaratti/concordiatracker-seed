import { CornerDownLeft, MonitorSmartphone } from 'lucide-react'
import { STATUS_META, type AdminTicket, type TicketPerson } from '@/lib/tickets'
import { cn } from '@/lib/cn'
import { TicketAvatar } from './ticket-ui'
import { ago } from './ticket-helpers'

/**
 * The queue. Each row leads with WHO (face, name, Pro) because that decides
 * how you answer, then what it is about, then how long it has waited. A row
 * that is waiting on us carries an accent edge: the one thing a scan of the
 * list has to find.
 */
export function TicketQueue({
  rows,
  people,
  selectedId,
  onSelect,
}: {
  rows: AdminTicket[]
  people: Map<string, TicketPerson>
  selectedId: string | null
  onSelect: (t: AdminTicket) => void
}) {
  return (
    <ul className="divide-y divide-border">
      {rows.map((t) => {
        const person = t.user_id ? people.get(t.user_id) : undefined
        const waiting = t.awaiting_reply && t.status !== 'solved'
        const who = person?.name ?? t.name ?? t.email
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t)}
              className={cn(
                'relative flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors duration-150 hover:bg-surface-2/70',
                selectedId === t.id && 'bg-surface-2',
              )}
            >
              {waiting && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
              <TicketAvatar ticket={t} person={person} className="size-9 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-semibold text-fg">{who}</span>
                  {person?.is_pro && (
                    <span className="shrink-0 rounded bg-accent-soft px-1 py-px text-[10px] font-semibold text-accent">
                      PRO
                    </span>
                  )}
                  {t.source === 'docs' && (
                    <MonitorSmartphone size={11} className="shrink-0 text-subtle" aria-label="Filed from the docs" />
                  )}
                  <span className="ml-auto shrink-0 text-[11px] text-subtle tabular-nums">{ago(t.last_activity_at)}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-muted">{t.subject}</span>
                <span className="mt-1 flex items-center gap-2 text-[11px] text-subtle">
                  <span className={cn('inline-flex items-center gap-1 font-medium', STATUS_META[t.status].text)}>
                    <span className={cn('size-1.5 rounded-full', STATUS_META[t.status].dot)} aria-hidden />
                    {STATUS_META[t.status].label}
                  </span>
                  <span className="tabular-nums">{t.case_id}</span>
                  {waiting && (
                    <span className="inline-flex items-center gap-1 font-medium text-accent">
                      <CornerDownLeft size={10} aria-hidden />
                      Needs reply
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
