import { useEffect, useState } from 'react'
import { myTickets, type TicketSummary } from '@/lib/tickets'

/**
 * Your support conversations.
 *
 * In its own file because `SupportThreads.tsx` exports components, and a
 * module that exports both loses fast refresh (`react-refresh/only-export-
 * components`) — the same split `SOCIAL_FIELDS` and `meeting-times.ts` needed.
 */
export function useSupportThreads(tick: number) {
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null)

  useEffect(() => {
    let alive = true
    // A missing migration, or a signed-out moment, costs the support section
    // and nothing else — the message list must still render.
    void myTickets()
      .then((r) => alive && setTickets(r))
      .catch(() => alive && setTickets([]))
    return () => {
      alive = false
    }
  }, [tick])

  return {
    tickets: tickets ?? [],
    loading: tickets === null,
    unread: (tickets ?? []).filter((t) => t.has_unread).length,
  }
}
