import { supabase } from '@/lib/supabase'

/**
 * Support tickets — client wrappers over the RPCs in db/tickets.sql.
 *
 * Every write goes through a SECURITY DEFINER function rather than a table
 * insert, so status, case numbers, and — importantly — whether a message renders
 * as "Support" are decided server-side and can't be spoofed from here.
 */

export type TicketStatus = 'open' | 'answered' | 'solved'
export type TicketCategory = 'billing' | 'bug' | 'account' | 'feature' | 'other'

export const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: 'bug', label: 'Something is broken' },
  { value: 'billing', label: 'Billing or subscription' },
  { value: 'account', label: 'My account' },
  { value: 'feature', label: 'Feature request' },
  { value: 'other', label: 'Something else' },
]

/** Label + tone per status, so the badge reads the same everywhere. */
export const STATUS_META: Record<TicketStatus, { label: string; dot: string; text: string }> = {
  open: { label: 'Open', dot: 'bg-warning', text: 'text-warning' },
  answered: { label: 'Answered', dot: 'bg-info', text: 'text-info' },
  solved: { label: 'Solved', dot: 'bg-success', text: 'text-success' },
}

export interface TicketSummary {
  id: string
  case_id: string
  subject: string
  category: string
  status: TicketStatus
  created_at: string
  last_activity_at: string
  has_unread: boolean
}

export interface TicketMessage {
  id: string
  author_role: 'user' | 'staff'
  author_name: string
  body: string
  created_at: string
}

export async function myTickets(): Promise<TicketSummary[]> {
  const { data, error } = await supabase.rpc('my_tickets')
  if (error) throw error
  return (data ?? []) as TicketSummary[]
}

/** Also marks the thread read, which is why it isn't a plain select. */
export async function ticketThread(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase.rpc('ticket_thread', { p_ticket_id: ticketId })
  if (error) throw error
  return (data ?? []) as TicketMessage[]
}

export async function submitTicket(input: {
  subject: string
  message: string
  category: TicketCategory
  page?: string
}): Promise<{ caseId: string }> {
  const { data, error } = await supabase.rpc('submit_ticket', {
    p_subject: input.subject,
    p_body: input.message,
    p_category: input.category,
    p_source: 'app',
    p_context: { page: input.page ?? window.location.pathname },
  })
  if (error) throw error
  const row = (Array.isArray(data) ? data[0] : data) as { case_id: string } | undefined
  return { caseId: row?.case_id ?? '' }
}

export async function replyToTicket(ticketId: string, body: string): Promise<void> {
  const { error } = await supabase.rpc('reply_ticket', { p_ticket_id: ticketId, p_body: body })
  if (error) throw error
}

/* ── Admin ─────────────────────────────────────────────────────────────────── */

export interface AdminTicket extends TicketSummary {
  source: 'app' | 'docs'
  email: string
  name: string | null
  user_id: string | null
  message_count: number
  awaiting_reply: boolean
}

export async function adminTickets(status?: TicketStatus | null, q?: string): Promise<AdminTicket[]> {
  const { data, error } = await supabase.rpc('admin_tickets', {
    p_status: status ?? null,
    p_q: q ?? null,
  })
  if (error) throw error
  return (data ?? []) as AdminTicket[]
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const { error } = await supabase.rpc('set_ticket_status', {
    p_ticket_id: ticketId,
    p_status: status,
  })
  if (error) throw error
}

export async function openTicketCount(): Promise<number> {
  const { data, error } = await supabase.rpc('admin_open_ticket_count')
  if (error) return 0
  return typeof data === 'number' ? data : 0
}
