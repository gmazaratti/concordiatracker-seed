import { supabase } from './supabase'
import type { RecordSnapshot } from './record-export'

/**
 * People and direct messages.
 *
 * ONE RELATIONSHIP NOW. Follows are the whole graph and a mutual follow IS the
 * connection — see db/social_follow_model.sql. "Friend" survives here as the
 * name of a row on the people screen, not as a second kind of tie.
 *
 * Every rule that matters is enforced in the database, not here: who may write
 * to whom, the one-message limit on a stranger, the no-link rule on that
 * message, and a timetable that comes back empty unless they turned it on.
 * This file is a typed way to ask — it is not the guard, and it must never be
 * treated as one.
 */
export interface Friend {
  /** The counterpart's user id. Only ever used as a key; every action takes a
   *  handle now that there is no friendship row to point at. */
  friendship_id: string
  user_id: string
  handle: string
  name: string | null
  avatar_url: string | null
  program: string | null
  /**
   * accepted  — mutual follow, or a conversation you have taken part in
   * request   — a stranger has written to you and you have not answered
   * pending   — they follow you and you have not followed back
   * following — you follow them and they have not followed back
   */
  status: 'pending' | 'accepted' | 'request' | 'following'
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
  /**
   * An academic record, SNAPSHOT not reference — for the same reason a
   * schedule is. Your archived `courses` rows are select-own, so a reference to
   * them is unreadable to whoever you sent it to. It is also the honest shape:
   * "here is what I had finished as of today" is what you mean when you send
   * this, and it should not silently change behind them.
   */
  | { kind: 'record'; snapshot: RecordSnapshot }
  | { kind: 'blueprint'; id: string; code: string }
  | { kind: 'event'; id: string; title: string }
  /**
   * "Can I see your schedule?" — a PROMPT, not a sentence.
   *
   * It used to send instructions ("Settings → Privacy → …"), which asks the
   * other person to go and find a switch on the strength of a message from
   * someone who wants something. Now they get the decision itself, with the
   * limits of it stated on the card: Allow or Deny, in the conversation.
   *
   * There is deliberately NO request row and no pending/approved state. The
   * answer IS the existing `schedule_visibility` setting, so the card always
   * shows the truth rather than a second copy of it that can drift, and
   * changing your mind later is the same switch it always was.
   */
  | { kind: 'schedule_request' }

export interface Message {
  id: string
  sender: string
  recipient: string
  body: string
  attachment: Attachment | null
  created_at: string
  read_at: string | null
}

/**
 * Somebody who is not in your list, shaped like somebody who is.
 *
 * `my_friends` is the FOLLOW GRAPH — it returns people you follow, people who
 * follow you, and people who have written to you. Everyone else on the service
 * is simply absent from it, which is correct for a contacts list and was quietly
 * wrong everywhere the app then said "open a conversation with this person":
 * the Message button on a stranger's profile hands over `?chat=handle`, the
 * panel could not find them, and it dropped you on the inbox with no
 * explanation.
 *
 * Whether you may actually SEND anything is not decided here and never was —
 * `ct_dm_block_reason` and the insert policy decide that, and the composer
 * reports what they say. This only answers "who is that handle".
 */
export async function lookupPerson(handle: string): Promise<Friend | null> {
  const clean = handle.trim().replace(/^@+/, '')
  if (!clean) return null
  const { data, error } = await supabase.rpc('get_public_profile', { p_handle: clean })
  if (error) return null
  const row = (data as { user_id?: string; handle?: string; name?: string | null; avatar_url?: string | null }[] | null)?.[0]
  if (!row?.user_id || !row.handle) return null
  return {
    friendship_id: row.user_id,
    user_id: row.user_id,
    handle: row.handle,
    name: row.name ?? null,
    avatar_url: row.avatar_url ?? null,
    program: null,
    // Not a claim about the relationship — just "we have not been introduced".
    status: 'following',
    direction: 'outgoing',
    created_at: new Date(0).toISOString(),
  }
}

export async function listFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('my_friends')
  if (error) return []
  return (data ?? []) as Friend[]
}

/**
 * Follow somebody. Returns a message on failure, null on success.
 *
 * This used to open a request that had to be accepted. There is nothing to
 * accept any more: following is instant and one-way, and if they follow back
 * you are connected. The three functions below are the same write for that
 * reason — they are kept apart because the SENTENCE differs at each call site
 * ("Follow", "Follow back", "Unfollow") and collapsing them would make the
 * buttons read wrong.
 */
export async function requestFriend(handle: string): Promise<string | null> {
  const { data: me } = await supabase.auth.getUser()
  if (!me.user) return 'You need to be signed in.'
  const { data, error } = await supabase.rpc('follow_user', { p_handle: handle, p_follow: true })
  if (error) return 'Could not follow that account.'
  return data === true ? null : `No one here has the handle @${handle}.`
}

/** Follow back somebody who already follows you. */
export async function acceptFriend(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('follow_user', { p_handle: handle, p_follow: true })
  return !error && data === true
}

/** Unfollow. There is no "decline" — nobody is waiting on your permission. */
export async function removeFriend(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('follow_user', { p_handle: handle, p_follow: false })
  return !error && data === true
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
  // 42501 is the insert policy. It can now mean several different things —
  // they have messages off, they only take them from people they follow back,
  // you have already used your one message, or the text has a link in it — so
  // ask the database WHICH rather than guessing at a sentence.
  if (error.code === '42501') {
    const { data } = await supabase.rpc('ct_dm_block_reason', {
      p_from: me.user.id,
      p_to: recipient,
      p_body: body.trim(),
    })
    return dmRefusal(typeof data === 'string' ? data : null)
  }
  return 'Could not send that.'
}

/** The reason a write was refused, in words, from the RECIPIENT's side — every
 *  one of these is their choice, and the sender is not owed a tour of their
 *  settings beyond the fact. */
export function dmRefusal(reason: string | null): string {
  switch (reason) {
    case 'closed':
      return 'This person has messages turned off.'
    case 'mutuals-only':
      return 'They only accept messages from people they follow back.'
    case 'request-pending':
      return 'You have already sent your one message. You can write again once they follow you back.'
    case 'blocked':
      return 'You cannot message this account.'
    case 'link':
      return 'A first message to someone new cannot contain a link.'
    case 'too-long':
      return 'That first message is too long — 500 characters maximum.'
    case 'rate':
      return 'You have started a lot of new conversations today. Try again tomorrow.'
    default:
      return 'Could not send that.'
  }
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

/**
 * Ask someone to share their timetable.
 *
 * A plain message rather than a new "schedule request" table with its own
 * state machine and its own notification: the answer to "can I see your
 * schedule" is a conversation, and one already exists. The switch they need
 * is named in the text so they are not left hunting for it.
 *
 * Messaging requires an accepted friendship (enforced by RLS, not here), so
 * this returns the same honest failure `sendMessage` does when you are not
 * connected — the button is not hidden on a guess about what the server will
 * allow.
 */
export async function requestSchedule(handle: string): Promise<string | null> {
  const { data: theirId } = await supabase.rpc('user_id_for_handle', { p_handle: handle })
  if (!theirId) return `No one here has the handle @${handle}.`
  // The body is still a readable sentence on purpose: it is what a
  // notification preview shows, and what an older client that does not know
  // this attachment kind would fall back to rendering.
  return sendMessage(theirId as string, 'Asked to see your schedule.', { kind: 'schedule_request' })
}

/**
 * One message to somebody you are not connected to.
 *
 * Every rule is enforced in the DATABASE (db/message_requests.sql), not here:
 * one per person, ten a day, five hundred characters, and **no links**. This
 * function only translates the reason back into a sentence, because a client
 * check is a suggestion and the limits are the entire reason this is allowed
 * to exist at all.
 *
 * Returns null on success, or the reason it did not send.
 */
export async function sendMessageRequest(handle: string, body: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('send_message_request', {
    p_handle: handle,
    p_body: body,
  })
  if (error) return 'Could not send that right now.'
  const r = (data ?? {}) as { ok?: boolean; reason?: string; detail?: number }
  if (r.ok) return null
  switch (r.reason) {
    case 'link':
      return 'A first message cannot contain a link. Say who you are and they can ask for it.'
    case 'already_sent':
      return 'You have already sent them a request. They will see it when they look.'
    case 'already_friends':
      return 'You are already connected — just message them.'
    case 'rate':
      return `That is ${r.detail ?? 10} requests today, which is the limit. Try again tomorrow.`
    case 'too_long':
      return 'Keep a first message under 500 characters.'
    case 'empty':
      return 'Write something first.'
    case 'no_user':
      return `No one here has the handle @${handle.replace(/^@/, '')}.`
    case 'self':
      return 'That is you.'
    default:
      return 'Could not send that.'
  }
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
  /*
   * ALL FOUR SHAPES PEOPLE ACTUALLY TYPE: "@alex", "alex",
   * "https://instagram.com/alex" and — the one that used to break —
   * "instagram.com/alex" with no protocol, which fell through to the handle
   * branch and produced instagram.com/instagram.com%2Falex. Strip a leading
   * host (with or without www) before treating the rest as a handle.
   */
  const handle = v
    .replace(/^@/, '')
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/^(?:instagram\.com|x\.com|twitter\.com|linkedin\.com\/in|linkedin\.com)\/?/i, '')
    .replace(/\/+$/, '')
  switch (kind) {
    case 'instagram':
      return safeUrl ?? `https://instagram.com/${encodeURIComponent(handle)}`
    case 'x':
      return safeUrl ?? `https://x.com/${encodeURIComponent(handle)}`
    case 'linkedin':
      return safeUrl ?? `https://linkedin.com/in/${encodeURIComponent(handle)}`
    case 'website':
      // A website is the one field where a bare domain IS the answer, so the
      // host is kept rather than stripped.
      return safeUrl ?? `https://${v.replace(/^@/, '').replace(/^https?:\/\//i, '').replace(/^\/+/, '')}`
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

/* ── Blocking ─────────────────────────────────────────────────────────────
 *
 * Every one of these is an RPC rather than a table write, because blocking is
 * not one row: it also has to tear down the friendship and the follow in both
 * directions. Doing that from the client would be three requests that can half
 * fail, leaving a block with a live message thread behind it.
 */

/** Block someone. Disconnects and unfollows both ways, server-side. */
export async function blockUser(handle: string): Promise<boolean> {
  const { error } = await supabase.rpc('block_user', { p_handle: handle })
  return !error
}

export async function unblockUser(handle: string): Promise<boolean> {
  const { error } = await supabase.rpc('unblock_user', { p_handle: handle })
  return !error
}

/** Did I block them? Decides whether the menu offers Block or Unblock. */
export async function haveIBlocked(handle: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('have_i_blocked', { p_handle: handle })
  return !error && data === true
}

export interface BlockedUser {
  handle: string
  name: string | null
  avatar_url: string | null
  created_at: string
}

/** Who I have blocked — so it can be undone somewhere other than their profile,
 *  which is the one place a blocked person's profile will not open. */
export async function listBlocks(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('my_blocks')
  return error ? [] : ((data as BlockedUser[] | null) ?? [])
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

/** The outside view of one conversation: who, what last, when, how many unread. */
export interface Thread {
  /** A user id, or an ORGANISATION id when `other_kind` is 'org'. */
  other: string
  other_kind: 'user' | 'org'
  /** Carried on the row so the inbox can render itself. It used to be
   *  assembled from `my_friends`, which is the follow graph between PEOPLE and
   *  can never contain a club. */
  other_handle: string | null
  other_name: string | null
  other_avatar: string | null
  last_body: string | null
  last_attachment: Attachment | null
  last_sender: string | null
  last_from_me: boolean
  last_at: string | null
  unread: number
}

/**
 * Every conversation's last line and unread count, in one call.
 *
 * Returns an empty list rather than throwing when the RPC is missing, so a
 * pending migration costs the previews and never the message list itself —
 * the same rule `searchCoursesEnriched` follows.
 */
export async function listThreads(): Promise<Thread[]> {
  const { data, error } = await supabase.rpc('my_threads')
  if (error || !data) return []
  return data as Thread[]
}

/** Mark everything they sent as read. Returns how many changed. */
export async function markThreadRead(other: string): Promise<number> {
  const { data } = await supabase.rpc('mark_thread_read', { p_other: other })
  return typeof data === 'number' ? data : 0
}

/**
 * What a conversation's last line should say.
 *
 * An attachment has no body worth showing — "You sent an attachment" is what
 * every other messenger falls back to, and it is uninformative. Naming the
 * KIND ("Sent a schedule") is the same length and actually tells you whether
 * the thread needs you.
 */
export function threadPreview(t: Thread, mine: boolean): string {
  const who = mine ? 'You' : ''
  const verb = (v: string) => (mine ? `You ${v}` : v.charAt(0).toUpperCase() + v.slice(1))
  const a = t.last_attachment
  if (a) {
    switch (a.kind) {
      case 'schedule':
        return verb('sent a schedule')
      case 'record':
        return verb('sent a record')
      case 'event':
        return verb('sent an event')
      case 'course':
        return verb('sent a class')
      case 'blueprint':
        return verb('sent an outline')
      case 'schedule_request':
        return mine ? 'You asked to see their schedule' : 'Asked to see your schedule'
    }
  }
  const body = (t.last_body ?? '').trim()
  if (!body) return who ? 'You sent a message' : 'Sent a message'
  return mine ? `You: ${body}` : body
}

/** "3h", "2d", "now" — a width that does not move as the list updates. */
export function shortAgo(iso: string | null, now: number): string {
  if (!iso) return ''
  const ms = now - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return 'now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'now'
  if (min < 60) return `${min}m`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h`
  const d = Math.floor(hr / 24)
  if (d < 7) return `${d}d`
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w`
  return `${Math.floor(d / 365) >= 1 ? Math.floor(d / 365) + 'y' : Math.floor(d / 30) + 'mo'}`
}
