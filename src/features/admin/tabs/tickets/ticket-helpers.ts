import type { TicketStatus } from '@/lib/tickets'

export const STATUSES: TicketStatus[] = ['open', 'answered', 'solved']

/** "3m", "2h", "4d", then a date. Module level so no clock is read in render. */
export function ago(iso: string): string {
  const d = Math.max(0, Date.now() - new Date(iso).getTime())
  const m = Math.floor(d / 60_000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
