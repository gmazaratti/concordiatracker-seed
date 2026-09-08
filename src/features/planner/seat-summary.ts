import type { SectionOption } from '@/lib/seats'

/**
 * Seat counts, stated as the numbers they are.
 *
 * Read when the section was added and not since — a count presented as live
 * that is four days old is how someone plans around a class they were never in,
 * so the caveat travels with the number rather than living in a footnote.
 *
 * Its own module, not part of the card that renders it, because the picked list
 * shows the headline too and a second implementation would eventually disagree
 * with the first about what "full" means.
 */
export interface SeatSummary {
  open: number
  headline: string
  detail: string
}

export function seatSummary(s: SectionOption): SeatSummary | null {
  if (s.capacity === null || s.enrolled === null) return null
  const open = Math.max(s.capacity - s.enrolled, 0)
  const waiting = s.waitlisted ?? 0
  const headline =
    open > 0
      ? `${open} seat${open === 1 ? '' : 's'} open of ${s.capacity}`
      : `Full — ${waiting} on the waitlist`
  const parts = [`${s.enrolled} of ${s.capacity} registered.`]
  if (s.waitlistCap) parts.push(`Waitlist ${waiting}/${s.waitlistCap}.`)
  else if (waiting > 0) parts.push(`${waiting} waiting.`)
  if (s.hasReserved) parts.push('Some seats are reserved for particular programmes.')
  parts.push('Read when this section was added; register in the Student Centre.')
  return { open, headline, detail: parts.join(' ') }
}
