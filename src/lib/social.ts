import { supabase } from './supabase'

/**
 * Friends and direct messages.
 *
 * Every rule that matters is enforced in the database, not here: you cannot
 * insert a message to someone who is not an accepted friend, you cannot accept
 * a request that was not sent to you, and a friend's timetable comes back empty
 * unless they turned it on. This file is a typed way to ask — it is not the
 * guard, and it must never be treated as one.
 */
export interface Friend {
  friendship_id: string
  user_id: string
  handle: string
  name: string | null
  avatar_url: string | null
  program: string | null
  status: 'pending' | 'accepted'
  direction: 'incoming' | 'outgoing'
  created_at: string
}

/** What a message can carry besides words. A REFERENCE, never a copy — see the
 *  note in db/social.sql: a shared schedule shows what it says today. */
export type Attachment =
  | { kind: 'schedule'; id: string; name: string }
  | { kind: 'course'; code: string; title?: string }
  | { kind: 'blueprint'; id: string; code: string }

export interface Message {
  id: string
  sender: string
  recipient: string
  body: string
  attachment: Attachment | null
  created_at: string
  read_at: string | null
}

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('my_friends')
  if (error) return []
  return (data ?? []) as Friend[]
}

/** Send a request by handle. Returns a message on failure, null on success. */
export async function requestFriend(handle: string): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'

  const { data: theirId } = await supabase.rpc('user_id_for_handle', { p_handle: handle })
  if (!theirId) return `No one here has the handle @${handle}.`
  if (theirId === me.user.id) return 'That is you.'

  const { error } = await supabase
    .from('friendships')
    .insert({ requester: me.user.id, addressee: theirId, status: 'pending' })
  // The unique index on the ORDERED pair is what makes this reachable: it fires
  // whether they asked you or you asked them, which is exactly what we want to
  // report rather than silently creating a mirrored second row.
  if (error) {
    return error.code === '23505'
      ? 'There is already a request between you two.'
      : 'Could not send that request.'
  }
  return null
}

export async function acceptFriend(friendshipId: string): Promise<boolean> {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', friendshipId)
  return !error
}

/** Declining and unfriending are the same row deletion, deliberately: a
 *  declined request that lingers is a record of a rejection nobody needs. */
export async function removeFriend(friendshipId: string): Promise<boolean> {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  return !error
}

/** The conversation with one person, oldest first. */
export async function listMessages(otherId: string, limit = 100): Promise<Message[]> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return []
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .or(
      `and(sender.eq.${me.user.id},recipient.eq.${otherId}),and(sender.eq.${otherId},recipient.eq.${me.user.id})`,
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return ((data ?? []) as Message[]).reverse()
}

export async function sendMessage(
  recipient: string,
  body: string,
  attachment?: Attachment,
): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'
  const { error } = await supabase.from('messages').insert({
    sender: me.user.id,
    recipient,
    body: body.trim(),
    attachment: attachment ?? null,
  })
  if (!error) return null
  // The insert policy requires an accepted friendship, so this is the message
  // a rejected write actually means.
  return error.code === '42501'
    ? 'You can only message people you are friends with.'
    : 'Could not send that.'
}

export async function markRead(otherId: string): Promise<void> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return
  await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient', me.user.id)
    .eq('sender', otherId)
    .is('read_at', null)
}

export async function unreadCount(): Promise<number> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 0
  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient', me.user.id)
    .is('read_at', null)
  return count ?? 0
}

export interface FriendCourse {
  code: string
  title: string | null
  color: string | null
  term: string | null
  meeting_times: string | null
  location: string | null
}

/**
 * A friend's timetable — when and where, never how they are doing.
 *
 * Comes back empty both when you are not their friend and when they have it
 * switched off, on purpose: a different answer for each would turn this into a
 * way to probe someone's privacy settings.
 */
export async function friendSchedule(handle: string): Promise<FriendCourse[]> {
  const { data, error } = await supabase.rpc('get_friend_schedule', { p_handle: handle })
  if (error) return []
  return (data ?? []) as FriendCourse[]
}

export async function canSeeSchedule(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_see_schedule', { p_handle: handle })
  return !error && data === true
}

/** Profile links. Only the four we render; anything else is ignored rather than
 *  echoed back out, so the column cannot become a place to stash arbitrary
 *  text that another user's browser will render. */
export interface ProfileLinks {
  instagram?: string
  linkedin?: string
  x?: string
  website?: string
}

export function cleanLinks(raw: unknown): ProfileLinks {
  const src = (raw ?? {}) as Record<string, unknown>
  const out: ProfileLinks = {}
  for (const key of ['instagram', 'linkedin', 'x', 'website'] as const) {
    const v = typeof src[key] === 'string' ? (src[key] as string).trim() : ''
    if (v) out[key] = v.slice(0, 200)
  }
  return out
}

/**
 * The URL a link field turns into.
 *
 * Handles are stored as typed — "@alex", "alex", or a full URL all work —
 * because asking a student to paste a canonical profile URL is asking them to
 * go and find one. Anything that is not plainly http(s) is rebuilt from the
 * platform's own base, so a `javascript:` string can never become an href.
 */
export function linkHref(kind: keyof ProfileLinks, value: string): string | null {
  const v = value.trim()
  if (!v) return null
  const safeUrl = /^https?:\/\//i.test(v) ? v : null
  const handle = v.replace(/^@/, '').replace(/\/+$/, '')
  switch (kind) {
    case 'instagram':
      return safeUrl ?? `https://instagram.com/${encodeURIComponent(handle)}`
    case 'x':
      return safeUrl ?? `https://x.com/${encodeURIComponent(handle)}`
    case 'linkedin':
      return safeUrl ?? `https://linkedin.com/in/${encodeURIComponent(handle)}`
    case 'website':
      return safeUrl ?? `https://${handle.replace(/^\/+/, '')}`
  }
}
