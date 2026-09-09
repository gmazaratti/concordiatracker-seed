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

/** One class in a sent schedule. Enough to draw a week, and nothing more. */
export interface SharedClass {
  code: string
  /** "Mon · Wed 10:15–11:30", exactly as the app stores it. */
  meets: string
  room?: string
  section?: string
}

/**
 * What a message can carry besides words.
 *
 * A COURSE and an EVENT stay references: both are readable by the recipient in
 * their own right, so pointing at them means they always open the current
 * thing.
 *
 * A SCHEDULE carries a snapshot, and that is a deliberate reversal. Two reasons:
 * schedules are private rows, so a reference is unreadable to the person you
 * sent it to and would render as an empty box; and the point of sending one is
 * "here is my week" — a picture of a moment, which is what somebody screenshots
 * today. It is stamped with when it was sent so it can never pass for live.
 */
export type Attachment =
  | {
      kind: 'schedule'
      id: string
      name: string
      classes?: SharedClass[]
      /** ISO. Shown on the card, because a snapshot must say when it was true. */
      sentAt?: string
      /** Hours a week, precomputed so the card needs no parser. */
      hours?: number
    }
  | { kind: 'course'; code: string; title?: string; color?: string; credits?: number }
  | { kind: 'blueprint'; id: string; code: string }
  | { kind: 'event'; id: string; title: string }

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

/**
 * Following, which is not the same as connecting.
 *
 * A follow is one-way, needs nobody's permission, and grants nothing — you see
 * what they publish publicly and that is all. A connection is two-way, has to
 * be accepted, and is the only thing that unlocks anything.
 *
 * Both exist so that "add friend" does not become the button people press on
 * strangers to get at a timetable. Following is the low-stakes action, which is
 * what lets the high-stakes one stay meaningful.
 */
export async function isFollowing(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('am_following', { p_handle: handle })
  return !error && data === true
}

export async function followUser(handle: string): Promise<boolean> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return false
  const { data: theirId } = await supabase.rpc('user_id_for_handle', { p_handle: handle })
  if (!theirId || theirId === me.user.id) return false
  const { error } = await supabase
    .from('user_follows')
    .insert({ follower: me.user.id, following: theirId })
  // Already following is a success from where the caller stands: the button
  // should end up saying "Following" either way.
  return !error || error.code === '23505'
}

export async function unfollowUser(handle: string): Promise<boolean> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return false
  const { data: theirId } = await supabase.rpc('user_id_for_handle', { p_handle: handle })
  if (!theirId) return false
  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower', me.user.id)
    .eq('following', theirId)
  return !error
}

export interface FollowedUser {
  user_id: string
  handle: string
  name: string | null
  avatar_url: string | null
  program: string | null
  created_at: string
}

export async function listFollowing(): Promise<FollowedUser[]> {
  const { data, error } = await supabase.rpc('my_following')
  if (error) return []
  return (data ?? []) as FollowedUser[]
}
