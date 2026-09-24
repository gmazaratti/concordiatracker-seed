import { demoDmCandidates, demoMarkRead, demoOrgMessages, demoOrgThreads, demoReply, isDemoOrgId } from './demo-org'
import { supabase } from './supabase'
import type { Attachment } from './social'

/**
 * Messaging a club, and a club answering.
 *
 * A CLUB IS AN ACCOUNT, NOT A PERSON WITH A LOGO. Story replies used to be
 * delivered to whoever happened to own the organisation, which put a student's
 * message in one individual's DMs and took the club's conversations with them
 * when they graduated. `messages` now knows that either end can be an
 * organisation — see db/org_inbox.sql for the rules, which are enforced there
 * and not here.
 *
 * WHAT DIFFERS FROM A PERSON-TO-PERSON DM, and why:
 *   • No one-message limit and no link rule. A club is a public account that
 *     exists to be contacted, and a real message to one often carries a link.
 *     The stranger rules exist to stop harassment of a PERSON.
 *   • A daily ceiling instead, which nobody reaches and a script does.
 *   • The club can only reply to somebody who wrote to it first, so it can
 *     never become a channel for unsolicited mail.
 */

/** Null on success, otherwise the reason in words. */
export async function sendMessageToOrg(
  orgId: string,
  body: string,
  attachment?: Attachment,
): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'
  const text = body.trim()
  if (!text) return 'Write something first.'

  const { error } = await supabase.from('messages').insert({
    sender: me.user.id,
    recipient: null,
    recipient_org: orgId,
    body: text,
    attachment: attachment ?? null,
  })
  if (!error) return null
  if (error.code === '42501') {
    // Ask the database WHICH rule refused rather than guessing at a sentence —
    // the same pattern `sendMessage` uses for the person-to-person path.
    const { data } = await supabase.rpc('ct_org_dm_block_reason', {
      p_from: me.user.id,
      p_org: orgId,
      p_body: text,
    })
    return orgRefusal(typeof data === 'string' ? data : null)
  }
  // PGRST204: the columns are not there yet. Say what is actually wrong
  // rather than "could not send", which reads as the club's fault.
  if (error.code === 'PGRST204') return 'Messaging clubs is not switched on yet.'
  return 'Could not send that.'
}

export function orgRefusal(reason: string | null): string {
  switch (reason) {
    case 'closed':
      return 'This club is not accepting messages yet.'
    case 'self':
      return 'This is your own club. Open its inbox in the organizer portal.'
    case 'too-long':
      return 'That message is too long.'
    case 'rate':
      return 'You have messaged a lot of clubs today. Try again tomorrow.'
    default:
      return 'Could not send that.'
  }
}

/** Reply AS a club. `orgId` must be one the caller helps run. */
export async function replyAsOrg(
  orgId: string,
  toUserId: string,
  body: string,
): Promise<string | null> {
  if (isDemoOrgId(orgId)) {
    if (!body.trim()) return 'Write something first.'
    demoReply(orgId, toUserId, body.trim())
    return null
  }
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'
  const text = body.trim()
  if (!text) return 'Write something first.'

  const { error } = await supabase.from('messages').insert({
    sender: me.user.id,
    sender_org: orgId,
    recipient: toUserId,
    body: text,
  })
  if (!error) return null
  return error.code === '42501'
    ? 'You can only reply to someone who wrote to the club first.'
    : 'Could not send that.'
}

// ── Reading ─────────────────────────────────────────────────────────────────

export interface OrgThread {
  other: string
  handle: string | null
  name: string | null
  avatar: string | null
  lastBody: string | null
  lastFromOrg: boolean
  lastAt: string | null
  unread: number
}

export async function orgThreads(orgId: string): Promise<OrgThread[]> {
  if (isDemoOrgId(orgId)) return demoOrgThreads(orgId)
  const { data, error } = await supabase.rpc('org_threads', { p_org: orgId })
  if (error || !Array.isArray(data)) return []
  return (
    data as {
      other: string
      other_handle: string | null
      other_name: string | null
      other_avatar: string | null
      last_body: string | null
      last_from_org: boolean
      last_at: string | null
      unread: number
    }[]
  ).map((t) => ({
    other: t.other,
    handle: t.other_handle,
    name: t.other_name,
    avatar: t.other_avatar,
    lastBody: t.last_body,
    lastFromOrg: !!t.last_from_org,
    lastAt: t.last_at,
    unread: t.unread ?? 0,
  }))
}

export interface OrgMessage {
  id: string
  body: string
  fromOrg: boolean
  /** Which teammate answered. Shown to the TEAM only; the student sees the club. */
  senderName: string | null
  createdAt: string
  readAt: string | null
}

export async function orgThreadMessages(orgId: string, other: string): Promise<OrgMessage[]> {
  if (isDemoOrgId(orgId)) return demoOrgMessages(orgId, other)
  const { data, error } = await supabase.rpc('org_thread_messages', {
    p_org: orgId,
    p_other: other,
  })
  if (error || !Array.isArray(data)) return []
  return (
    data as {
      id: string
      body: string
      from_org: boolean
      sender_name: string | null
      created_at: string
      read_at: string | null
    }[]
  ).map((m) => ({
    id: m.id,
    body: m.body,
    fromOrg: !!m.from_org,
    senderName: m.sender_name,
    createdAt: m.created_at,
    readAt: m.read_at,
  }))
}

export async function markOrgThreadRead(orgId: string, other: string): Promise<void> {
  if (isDemoOrgId(orgId)) return demoMarkRead(orgId, other)
  await supabase.rpc('mark_org_thread_read', { p_org: orgId, p_other: other })
}

/** Unread per club, for the portal's badge. */
export async function myOrgUnread(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('my_org_unread')
  if (error || !Array.isArray(data)) return {}
  const out: Record<string, number> = {}
  for (const r of data as { org_id: string; unread: number }[]) out[r.org_id] = r.unread ?? 0
  return out
}

// ── The student's side of a club thread ─────────────────────────────────────

export interface OrgDm {
  id: string
  body: string
  attachment: Attachment | null
  fromOrg: boolean
  createdAt: string
  readAt: string | null
}

/** The client's person-to-person read filters on sender/recipient ids and
 *  cannot express "…or addressed to this org", so this direction gets its own. */
export async function myThreadWithOrg(orgId: string): Promise<OrgDm[]> {
  const { data, error } = await supabase.rpc('my_thread_with_org', { p_org: orgId })
  if (error || !Array.isArray(data)) return []
  return (
    data as {
      id: string
      body: string
      attachment: Attachment | null
      from_org: boolean
      created_at: string
      read_at: string | null
    }[]
  ).map((m) => ({
    id: m.id,
    body: m.body,
    attachment: m.attachment ?? null,
    fromOrg: !!m.from_org,
    createdAt: m.created_at,
    readAt: m.read_at,
  }))
}

/* ── A club writing first ──────────────────────────────────────────────────
 *
 * Guarded on BOTH sides in the database: the person must follow the club, and
 * must not have switched club messages off. Either rule alone leaves a hole —
 * followers-only means unfollowing is the only way to stop it, an opt-out
 * alone is off for everybody who never finds the setting. See
 * `db/org_message_first.sql`.
 */

export interface DmCandidate {
  userId: string
  name: string
  handle: string | null
  avatarUrl: string | null
}

/** The club's followers who are open to being messaged. Searchable, because a
 *  club with four hundred followers needs a box rather than a list. */
export async function orgDmCandidates(orgId: string, q = ''): Promise<DmCandidate[]> {
  if (isDemoOrgId(orgId)) return demoDmCandidates(q)
  const { data, error } = await supabase.rpc('org_dm_candidates', { p_org: orgId, p_q: q })
  if (error) throw new Error(error.message)
  type Row = { user_id: string; name: string | null; handle: string | null; avatar_url: string | null }
  return ((data ?? []) as Row[]).map((r) => ({
    userId: r.user_id,
    name: r.name ?? 'Someone',
    handle: r.handle,
    avatarUrl: r.avatar_url,
  }))
}

/** Start a conversation. The refusal reason travels in the error DETAIL, so
 *  `orgRefusal` can say WHICH rule stopped it rather than "that did not
 *  work" — a message nobody can act on. */
export async function sendOrgDm(orgId: string, to: string, body: string): Promise<void> {
  if (isDemoOrgId(orgId)) return
  const { error } = await supabase.rpc('send_org_dm', {
    p_org: orgId,
    p_to: to,
    p_body: body,
  })
  if (error) {
    const reason = (error as { details?: string }).details ?? null
    throw new Error(orgDmRefusal(reason) || error.message)
  }
}

export function orgDmRefusal(reason: string | null): string {
  switch (reason) {
    case 'not_a_follower':
      return 'You can only start a conversation with somebody who follows your club.'
    case 'opted_out':
      return 'They have turned off messages from clubs.'
    case 'awaiting_reply':
      return 'You have already written to them. They have to answer before you can send another.'
    case 'blocked':
      return 'You cannot message this person.'
    case 'not_your_org':
      return 'You are not on this club’s team.'
    case 'rate_limited':
      return 'This club has sent a lot of messages today. Try again tomorrow.'
    default:
      return ''
  }
}
