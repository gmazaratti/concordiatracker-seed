import { supabase } from './supabase'
import { submitTicket } from './tickets'
import type { Message } from './social'

/**
 * Reactions, read receipts and reporting for direct messages — the client
 * half of db/message_extras.sql. Every write is a SECURITY DEFINER verb that
 * checks you are one end of the conversation; nothing here decides that.
 */

/** The same eight `ct_reaction_set()` allows. A fixed set, because a free
 *  text column would be a second unmoderated message attached to every one. */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍', '👏', '🙏'] as const
export const HEART = REACTIONS[0]

export interface Reaction {
  messageId: string
  userId: string
  emoji: string
}

export async function loadReactions(messageIds: string[]): Promise<Reaction[]> {
  if (messageIds.length === 0) return []
  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', messageIds)
  if (error || !data) return []
  return (data as { message_id: string; user_id: string; emoji: string }[]).map((r) => ({
    messageId: r.message_id,
    userId: r.user_id,
    emoji: r.emoji,
  }))
}

/** Sets, swaps or (same emoji again) removes your reaction. Returns what is
 *  there now, or throws with the database's sentence. */
export async function reactMessage(messageId: string, emoji: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('react_message', { p_message: messageId, p_emoji: emoji })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? null
}

export interface ReceiptsState {
  /** Your own switch for this chat. */
  mine: boolean
  /** Both of you have it on — the only state in which anything is shown. */
  shared: boolean
}

export async function receiptsState(otherId: string): Promise<ReceiptsState> {
  const { data, error } = await supabase.rpc('dm_receipts_state', { p_other: otherId })
  const row = (Array.isArray(data) ? data[0] : data) as ReceiptsState | undefined
  if (error || !row) return { mine: true, shared: false }
  return { mine: !!row.mine, shared: !!row.shared }
}

export async function setReceipts(otherId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_dm_receipts', { p_other: otherId, p_on: on })
  if (error) throw new Error(error.message)
}

/** When each of YOUR messages was read. Empty unless receipts are shared,
 *  which the server decides. */
export async function threadReceipts(otherId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.rpc('thread_receipts', { p_other: otherId })
  if (error || !Array.isArray(data)) return {}
  const out: Record<string, string> = {}
  for (const r of data as { message_id: string; read_at: string }[]) out[r.message_id] = r.read_at
  return out
}

/**
 * Report a message: it becomes a support ticket with the message's id, time
 * and text in it, so the person reviewing it sees exactly what was reported
 * rather than a paraphrase. Not anonymous — a ticket has an author — and the
 * confirmation says so before it is sent.
 */
export async function reportMessage(m: Message, from: { name: string | null; handle: string | null }): Promise<string> {
  const who = from.handle ? `@${from.handle}` : (from.name ?? 'someone')
  const { caseId } = await submitTicket({
    subject: `Reported message from ${who}`,
    category: 'other',
    message: [
      `A message was reported from a direct conversation.`,
      ``,
      `From: ${from.name ?? ''} ${who} (user ${m.sender})`,
      `Sent: ${new Date(m.created_at).toISOString()}`,
      `Message id: ${m.id}`,
      ``,
      `Text:`,
      m.body.trim() || '(no text — an attachment)',
    ].join('\n'),
  })
  return caseId
}

const AGO = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "Seen 3 hours ago", "Seen 2 days ago", "Seen just now". */
export function seenLabel(iso: string, now: number): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return 'Seen just now'
  const m = Math.round(s / 60)
  if (m < 60) return `Seen ${AGO.format(-m, 'minute')}`
  const h = Math.round(m / 60)
  if (h < 24) return `Seen ${AGO.format(-h, 'hour')}`
  return `Seen ${AGO.format(-Math.round(h / 24), 'day')}`
}
