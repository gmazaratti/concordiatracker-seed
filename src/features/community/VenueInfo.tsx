import { useState } from 'react'
import { ChevronDown, Clock, MapPin, Phone } from 'lucide-react'
import type { EventOrg } from '@/data/community'
import { cn } from '@/lib/cn'
import { hoursForDay } from './venue-hours'

/**
 * A venue's address, hours and phone, as plain lines under the bio — the way
 * a business profile reads on a map or a social app, not a boxed form.
 *
 * The address opens directions (the thing anyone wants from an address on a
 * phone). Hours lead with today's line, because "are they open tonight" is the
 * question; the full week is one tap away rather than always taking four rows.
 */
export function VenueInfo({ venue }: { venue: NonNullable<EventOrg['venue']> }) {
  const [open, setOpen] = useState(false)
  const hours = venue.hours ?? []
  const today = hours.length > 0 ? hoursForDay(hours, new Date().getDay()) : null

  return (
    <div className="mt-3 flex flex-col gap-1.5 text-[13px]">
      {venue.address && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex w-fit max-w-full items-start gap-2 text-fg/90"
        >
          <MapPin size={14} className="mt-[3px] shrink-0 text-subtle" aria-hidden />
          <span className="min-w-0 group-hover:underline">{venue.address}</span>
        </a>
      )}

      {hours.length > 0 && (
        <div className="flex items-start gap-2">
          <Clock size={14} className="mt-[3px] shrink-0 text-subtle" aria-hidden />
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 text-left text-fg/90 hover:text-fg"
            >
              {today ? (
                <span>
                  <span className="text-subtle">Today</span> · {today}
                </span>
              ) : (
                <span>Opening hours</span>
              )}
              <ChevronDown
                size={14}
                aria-hidden
                className={cn('shrink-0 text-subtle transition-transform duration-150', open && 'rotate-180')}
              />
            </button>
            {open && (
              <ul className="mt-1 space-y-0.5 text-[12.5px] text-muted">
                {hours.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {venue.phone && (
        <a
          href={`tel:${venue.phone.replace(/[^\d+]/g, '')}`}
          className="group flex w-fit items-center gap-2 text-fg/90"
        >
          <Phone size={14} className="shrink-0 text-subtle" aria-hidden />
          <span className="group-hover:underline">{venue.phone}</span>
        </a>
      )}
    </div>
  )
}
