import { Check } from 'lucide-react'
import { PersonAvatar } from '@/features/community/PersonAvatar'
import { STATUS_META, type AdminTicket, type TicketPerson, type TicketStatus } from '@/lib/tickets'
import { cn } from '@/lib/cn'
import { STATUSES } from './ticket-helpers'

/** The ticket author's face: their real photo, else initials; a docs ticket
 *  (no account) gets initials from the name it was filed under. */
export function TicketAvatar({
  ticket,
  person,
  className = 'size-9',
}: {
  ticket: AdminTicket
  person?: TicketPerson
  className?: string
}) {
  return (
    <PersonAvatar
      className={className}
      person={{
        handle: person?.handle ?? ticket.email,
        name: person?.name ?? ticket.name ?? ticket.email,
        avatar_url: person?.avatar_url ?? null,
      }}
    />
  )
}

/**
 * The three statuses as one segmented control: one tap, no menu, and the
 * current one is obvious. `size="sm"` is the version that fits in a queue row.
 */
export function StatusSwitch({
  value,
  onChange,
  size = 'md',
}: {
  value: TicketStatus
  onChange: (s: TicketStatus) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Ticket status"
      className="inline-flex shrink-0 rounded-lg border border-border bg-canvas p-0.5"
    >
      {STATUSES.map((s) => {
        const on = value === s
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={(e) => {
              e.stopPropagation()
              if (!on) onChange(s)
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors duration-150',
              size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
              on ? cn('bg-surface-2', STATUS_META[s].text) : 'text-subtle hover:text-fg',
            )}
          >
            <span className={cn('size-1.5 rounded-full', STATUS_META[s].dot)} aria-hidden />
            {STATUS_META[s].label}
            {on && s === 'solved' && <Check size={11} aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}
